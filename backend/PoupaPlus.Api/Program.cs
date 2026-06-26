using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Npgsql;
using PoupaPlus.Domain.Finance;

var builder = WebApplication.CreateBuilder(args);

var configuredUrls = builder.Configuration["ASPNETCORE_URLS"] ?? builder.Configuration["urls"];
if (string.IsNullOrWhiteSpace(configuredUrls))
{
    builder.WebHost.UseUrls("http://localhost:5254", "http://127.0.0.1:5254");
}

builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins("http://127.0.0.1:5173", "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? builder.Configuration["ConnectionStrings:Postgres"]
    ?? "Host=localhost;Port=5432;Database=poupa_plus;Username=poupa;Password=poupa_dev";

builder.Services.AddSingleton(new NpgsqlDataSourceBuilder(connectionString).Build());
builder.Services.AddSingleton<PostgresFinanceStore>();
builder.Services.AddSingleton<PasswordResetEmailSender>();

var enableHttpsRedirection = builder.Configuration.GetValue<bool>("EnableHttpsRedirection");

var app = builder.Build();

try
{
    await app.Services.GetRequiredService<PostgresFinanceStore>().EnsureSchemaAsync();
}
catch (Exception exception)
{
    app.Logger.LogWarning(exception, "PostgreSQL schema initialization failed. Health checks will report degraded until the database is available.");
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (enableHttpsRedirection)
{
    app.UseHttpsRedirection();
}
app.UseCors("frontend");

app.MapGet("/api/health", async (PostgresFinanceStore store) =>
{
    var databaseOk = await store.CanConnectAsync();

    return Results.Ok(new
    {
        service = "Poupa+ API",
        status = databaseOk ? "ok" : "degraded",
        database = databaseOk ? "postgres-connected" : "postgres-unavailable"
    });
});

app.MapPost("/api/auth/local", async (LocalLoginRequest request, PostgresFinanceStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email))
    {
        return Results.BadRequest(new ApiError("INVALID_LOGIN", "Informe nome e email."));
    }

    var user = await store.SignInAsync(request);
    return Results.Ok(user);
});


app.MapPost("/api/auth/register", async (RegisterAccountRequest request, PostgresFinanceStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new ApiError("INVALID_REGISTER", "Informe nome, email e senha."));
    }

    try
    {
        var user = await store.RegisterAccountAsync(request);
        return Results.Created($"/api/users/{user.Id}", user);
    }
    catch (InvalidOperationException exception) when (exception.Message == "EMAIL_ALREADY_REGISTERED")
    {
        return Results.Conflict(new ApiError("EMAIL_ALREADY_REGISTERED", "Email ja cadastrado."));
    }
});

app.MapPost("/api/auth/login", async (LoginAccountRequest request, PostgresFinanceStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new ApiError("INVALID_LOGIN", "Informe email e senha."));
    }

    var user = await store.LoginAccountAsync(request);
    return user is null
        ? Results.Unauthorized()
        : Results.Ok(user);
});

app.MapPost("/api/auth/password-reset", async (PasswordResetRequest request, PostgresFinanceStore store, PasswordResetEmailSender emailSender, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Email))
    {
        return Results.BadRequest(new ApiError("INVALID_EMAIL", "Informe um email."));
    }

    try
    {
        var token = await store.CreatePasswordResetTokenAsync(request.Email);
        if (token is not null)
        {
            await emailSender.SendAsync(request.Email, token, logger);
        }
    }
    catch (Exception exception)
    {
        logger.LogWarning(exception, "Password reset request could not be completed for {Email}.", request.Email.Trim().ToLowerInvariant());
        return Results.Problem(
            title: "RESET_UNAVAILABLE",
            detail: "Não foi possível iniciar a recuperação agora. Verifique se o banco PostgreSQL está rodando e tente novamente.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    return Results.Ok(new PasswordResetResponse("Se o email existir, enviaremos as instruÃ§Ãµes de recuperaÃ§Ã£o."));
});


app.MapPost("/api/auth/password-reset/confirm", async (PasswordResetConfirmRequest request, PostgresFinanceStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
    {
        return Results.BadRequest(new ApiError("INVALID_RESET", "Informe email, token e nova senha."));
    }

    if (request.NewPassword.Trim().Length < 6)
    {
        return Results.BadRequest(new ApiError("WEAK_PASSWORD", "A senha deve ter ao menos 6 caracteres."));
    }

    var changed = await store.CompletePasswordResetAsync(request);
    return changed
        ? Results.Ok(new PasswordResetResponse("Senha alterada com sucesso."))
        : Results.BadRequest(new ApiError("INVALID_RESET_TOKEN", "Link de recuperação inválido ou expirado."));
});
app.MapGet("/api/users", async (PostgresFinanceStore store) =>
{
    return Results.Ok(await store.GetRegisteredUsersAsync());
});
app.MapPost("/api/sync/push", async (SyncPushRequest request, PostgresFinanceStore store) =>
{
    if (request.Items.Count == 0)
    {
        return Results.BadRequest(new ApiError("EMPTY_SYNC_BATCH", "Informe ao menos um item para sincronizar."));
    }

    var results = new List<SyncPushItemResult>(request.Items.Count);

    foreach (var item in request.Items)
    {
        results.Add(await SyncPushProcessor.ProcessSyncItemAsync(item, store));
    }

    return Results.Ok(new SyncPushResponse(results));
});

app.MapGet("/api/households", async (Guid userId, PostgresFinanceStore store) =>
{
    return Results.Ok(await store.GetHouseholdAsync(userId));
});

app.MapPost("/api/households", async (CreateHouseholdRequest request, PostgresFinanceStore store) =>
{
    if (request.OwnerUserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new ApiError("INVALID_HOUSEHOLD", "Informe o nome do grupo."));
    }

    var household = await store.CreateHouseholdAsync(request);
    return Results.Created($"/api/households/{household.Id}", household);
});

app.MapGet("/api/households/{householdId:guid}/members", async (Guid householdId, PostgresFinanceStore store) =>
{
    return Results.Ok(await store.GetHouseholdMembersAsync(householdId));
});

app.MapPost("/api/households/{householdId:guid}/members", async (Guid householdId, CreateHouseholdMemberRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId is null && (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email)))
    {
        return Results.BadRequest(new ApiError("INVALID_MEMBER", "Informe nome e email do membro."));
    }

    var member = await store.AddHouseholdMemberAsync(householdId, request);
    return Results.Created($"/api/households/{householdId}/members/{member.Id}", member);
});

app.MapGet("/api/categories", async (Guid userId, PostgresFinanceStore store) =>
{
    return Results.Ok(await store.GetCategoriesAsync(userId));
});

app.MapPost("/api/categories", async (CreateCategoryRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new ApiError("INVALID_CATEGORY", "Informe o nome da categoria."));
    }

    var category = await store.AddCategoryAsync(request);
    return Results.Created($"/api/categories/{category.Id}", category);
});

app.MapGet("/api/transactions", async (Guid userId, int? page, int? pageSize, int? year, int? month, PostgresFinanceStore store) =>
{
    if (month is < 1 or > 12)
    {
        return Results.BadRequest(new ApiError("INVALID_MONTH", "MÃªs deve estar entre 1 e 12."));
    }

    var requestedPage = Math.Max(1, page ?? 1);
    var requestedPageSize = Math.Clamp(pageSize ?? 10, 1, 100);
    var result = await store.GetTransactionsPageAsync(userId, requestedPage, requestedPageSize, year, month);
    return Results.Ok(result);
});

app.MapDelete("/api/transactions", async ([FromBody] DeleteTransactionsRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (request.TransactionIds.Count == 0)
    {
        return Results.BadRequest(new ApiError("EMPTY_TRANSACTION_SELECTION", "Informe ao menos uma transaÃ§Ã£o."));
    }

    var deletedCount = await store.DeleteTransactionsAsync(request.UserId, request.TransactionIds);
    return Results.Ok(new DeleteTransactionsResponse(deletedCount));
});

app.MapPost("/api/transactions", async (CreateTransactionRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (string.IsNullOrWhiteSpace(request.Description))
    {
        return Results.BadRequest(new ApiError("INVALID_DESCRIPTION", "Informe uma descriÃ§Ã£o."));
    }

    if (request.Amount <= 0)
    {
        return Results.BadRequest(new ApiError("INVALID_AMOUNT", "Informe um valor maior que zero."));
    }

    var transaction = await store.AddTransactionAsync(request);
    return Results.Created($"/api/transactions/{transaction.Id}", transaction);
});

app.MapPost("/api/imports/statement", async (StatementImportRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (request.Transactions.Count > 200)
    {
        return Results.BadRequest(new ApiError("IMPORT_TOO_LARGE", "Importe no mÃ¡ximo 200 linhas por vez."));
    }

    var imported = 0;
    foreach (var item in request.Transactions.Where(item => !string.IsNullOrWhiteSpace(item.Description) && item.Amount > 0))
    {
        await store.AddTransactionAsync(item);
        imported++;
    }

    return Results.Ok(new StatementImportResponse(imported));
});

app.MapGet("/api/goals", async (Guid userId, PostgresFinanceStore store) =>
{
    return Results.Ok(await store.GetGoalsAsync(userId));
});

app.MapPost("/api/goals", async (CreateGoalRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new ApiError("INVALID_GOAL", "Informe o nome da meta."));
    }

    if (request.TargetAmount <= 0 || request.CurrentAmount < 0)
    {
        return Results.BadRequest(new ApiError("INVALID_GOAL_AMOUNT", "Valores da meta invÃ¡lidos."));
    }

    var goal = await store.AddGoalAsync(request);
    return Results.Created($"/api/goals/{goal.Id}", goal);
});

app.MapGet("/api/predictable-incomes", async (Guid userId, PostgresFinanceStore store) =>
{
    return Results.Ok(await store.GetPredictableIncomesAsync(userId));
});

app.MapPost("/api/predictable-incomes", async (CreatePredictableIncomeRequest request, PostgresFinanceStore store) =>
{
    if (request.UserId == Guid.Empty)
    {
        return Results.BadRequest(new ApiError("INVALID_USER", "UsuÃ¡rio invÃ¡lido."));
    }

    if (string.IsNullOrWhiteSpace(request.Description))
    {
        return Results.BadRequest(new ApiError("INVALID_INCOME", "Informe a descriÃ§Ã£o da renda."));
    }

    if (request.Amount <= 0)
    {
        return Results.BadRequest(new ApiError("INVALID_INCOME_AMOUNT", "Informe uma renda maior que zero."));
    }

    var income = await store.AddPredictableIncomeAsync(request);
    return Results.Created($"/api/predictable-incomes/{income.Id}", income);
});

app.MapGet("/api/summaries/monthly", async (Guid userId, int year, int month, PostgresFinanceStore store) =>
{
    if (month is < 1 or > 12)
    {
        return Results.BadRequest(new ApiError("INVALID_MONTH", "MÃªs deve estar entre 1 e 12."));
    }

    var transactions = await store.GetTransactionsAsync(userId);
    var categories = await store.GetCategoriesAsync(userId);

    return Results.Ok(new MonthlySummaryResponse(
        FinanceCalculator.SummarizeMonth(transactions, year, month),
        FinanceCalculator.SummarizeExpensesByCategory(transactions, categories, year, month)));
});

app.MapGet("/api/projections/next-month", async (Guid userId, PostgresFinanceStore store) =>
{
    return Results.Ok(FinanceCalculator.ProjectNextMonth(
        await store.GetPredictableIncomesAsync(userId),
        await store.GetTransactionsAsync(userId)));
});

app.Run();

public sealed class PasswordResetEmailSender
{
    private readonly IConfiguration configuration;

    public PasswordResetEmailSender(IConfiguration configuration)
    {
        this.configuration = configuration;
    }

    public async Task SendAsync(string email, string token, ILogger logger)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var resetLink = BuildResetLink(normalizedEmail, token);
        var host = configuration["Smtp:Host"];
        var from = configuration["Smtp:From"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
        {
            logger.LogWarning("SMTP is not configured. Password reset link for {Email}: {ResetLink}", normalizedEmail, resetLink);
            logger.LogInformation("Password reset token for {Email}: {Token}", normalizedEmail, token);
            return;
        }

        using var message = new MailMessage(from, normalizedEmail)
        {
            Subject = "Recuperação de senha Poupa+",
            Body = $"Use este link para redefinir sua senha no Poupa+: {resetLink}",
            IsBodyHtml = false
        };

        using var client = new SmtpClient(host, GetInt("Smtp:Port", 587))
        {
            EnableSsl = GetBool("Smtp:EnableSsl", true)
        };

        var username = configuration["Smtp:Username"];
        var password = configuration["Smtp:Password"];
        if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
        {
            client.Credentials = new NetworkCredential(username, password);
        }

        await client.SendMailAsync(message);
        logger.LogInformation("Password reset email sent to {Email}.", normalizedEmail);
    }

    private string BuildResetLink(string email, string token)
    {
        var publicBaseUrl = (configuration["PasswordReset:PublicBaseUrl"] ?? "http://127.0.0.1:5173").TrimEnd('/');
        return $"{publicBaseUrl}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
    }

    private int GetInt(string key, int fallback)
    {
        return int.TryParse(configuration[key], out var value) ? value : fallback;
    }

    private bool GetBool(string key, bool fallback)
    {
        return bool.TryParse(configuration[key], out var value) ? value : fallback;
    }
}
public sealed record ApiError(string Code, string Message);
public sealed record LocalLoginRequest(Guid? Id, string Name, string Email);
public sealed record RegisterAccountRequest(Guid? Id, string Name, string Email, string Password);
public sealed record LoginAccountRequest(string Email, string Password);
public sealed record PasswordResetRequest(string Email);
public sealed record PasswordResetConfirmRequest(string Email, string Token, string NewPassword);
public sealed record PasswordResetResponse(string Message);
public sealed record LocalUser(Guid Id, string Name, string Email, DateTimeOffset CreatedAt);
public sealed record SyncPushRequest(IReadOnlyCollection<SyncPushItemRequest> Items);
public sealed record SyncPushItemRequest(
    Guid QueueItemId,
    Guid UserId,
    string Entity,
    Guid EntityId,
    string Operation,
    System.Text.Json.JsonElement Payload);
public sealed record SyncPushResponse(IReadOnlyCollection<SyncPushItemResult> Results);
public sealed record SyncPushItemResult(Guid QueueItemId, string Status, string? Message);
public sealed record HouseholdRecord(Guid Id, Guid OwnerUserId, string Name, DateTimeOffset CreatedAt);
public sealed record HouseholdMemberRecord(Guid Id, Guid HouseholdId, Guid? UserId, string Name, string Email, string Role, DateTimeOffset CreatedAt);
public sealed record CreateHouseholdRequest(Guid? Id, Guid OwnerUserId, string Name);
public sealed record CreateHouseholdMemberRequest(Guid? Id, Guid? UserId, string? Name, string? Email, string Role);
public sealed record CreateCategoryRequest(Guid? Id, Guid UserId, string Name, string Color, Guid? HouseholdId);
public sealed record CreateBudgetRequest(Guid? Id, Guid UserId, Guid CategoryId, string Name, string Color, string? BudgetKind, decimal? MonthlyAmount, decimal LimitAmount, string AllocationMode, decimal AllocationValue, string Preset, bool IsAutomatic);

public sealed record CreateTransactionRequest(
    Guid? Id,
    Guid UserId,
    TransactionKind Kind,
    string Description,
    decimal Amount,
    Guid? CategoryId,
    DateOnly OccurredAt);

public sealed record PagedTransactionsResponse(
    IReadOnlyCollection<TransactionRecord> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);

public sealed record DeleteTransactionsRequest(Guid UserId, IReadOnlyCollection<Guid> TransactionIds);
public sealed record DeleteTransactionsResponse(int DeletedCount);

public sealed record StatementImportRequest(Guid UserId, IReadOnlyCollection<CreateTransactionRequest> Transactions);
public sealed record StatementImportResponse(int ImportedCount);

public sealed record CreateGoalRequest(
    Guid? Id,
    Guid UserId,
    GoalKind Kind,
    string Name,
    decimal TargetAmount,
    decimal CurrentAmount,
    Guid? HouseholdId);

public sealed record CreatePredictableIncomeRequest(Guid? Id, Guid UserId, string Description, decimal Amount);

public sealed record MonthlySummaryResponse(
    MonthlySummary Summary,
    IReadOnlyCollection<CategoryTotal> CategoryTotals);

public sealed class PostgresFinanceStore
{
    private readonly NpgsqlDataSource dataSource;

    public PostgresFinanceStore(NpgsqlDataSource dataSource)
    {
        this.dataSource = dataSource;
    }

    public async Task EnsureSchemaAsync()
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(SchemaSql, connection);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<bool> CanConnectAsync()
    {
        try
        {
            await using var connection = await dataSource.OpenConnectionAsync();
            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<LocalUser> SignInAsync(LocalLoginRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var userId = request.Id ?? Guid.NewGuid();

        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO users (id, name, email)
            VALUES (@id, @name, @email)
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name, email, created_at;
            """,
            connection);
        command.Parameters.AddWithValue("id", userId);
        command.Parameters.AddWithValue("name", request.Name.Trim());
        command.Parameters.AddWithValue("email", normalizedEmail);

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        var user = new LocalUser(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetFieldValue<DateTimeOffset>(3));

        await reader.CloseAsync();
        await EnsureDefaultCategoriesAsync(user.Id, connection);
        return user;
    }


    public async Task<LocalUser> RegisterAccountAsync(RegisterAccountRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var userId = request.Id ?? Guid.NewGuid();
        var passwordHash = HashPassword(request.Password, normalizedEmail);

        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO users (id, name, email, password_hash)
            VALUES (@id, @name, @email, @passwordHash)
            ON CONFLICT (email) DO UPDATE
            SET name = EXCLUDED.name,
                password_hash = EXCLUDED.password_hash
            WHERE users.password_hash IS NULL
            RETURNING id, name, email, created_at;
            """,
            connection);
        command.Parameters.AddWithValue("id", userId);
        command.Parameters.AddWithValue("name", request.Name.Trim());
        command.Parameters.AddWithValue("email", normalizedEmail);
        command.Parameters.AddWithValue("passwordHash", passwordHash);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) throw new InvalidOperationException("EMAIL_ALREADY_REGISTERED");

        var user = new LocalUser(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetFieldValue<DateTimeOffset>(3));

        await reader.CloseAsync();
        await EnsureDefaultCategoriesAsync(user.Id, connection);
        return user;
    }

    public async Task<LocalUser?> LoginAccountAsync(LoginAccountRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var passwordHash = HashPassword(request.Password, normalizedEmail);

        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            SELECT id, name, email, created_at, password_hash
            FROM users
            WHERE email = @email
            LIMIT 1;
            """,
            connection);
        command.Parameters.AddWithValue("email", normalizedEmail);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        if (reader.IsDBNull(4) || reader.GetString(4) != passwordHash) return null;

        var user = new LocalUser(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetFieldValue<DateTimeOffset>(3));

        await reader.CloseAsync();
        await EnsureDefaultCategoriesAsync(user.Id, connection);
        return user;
    }

    public async Task<string?> CreatePasswordResetTokenAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        await using var connection = await dataSource.OpenConnectionAsync();
        await EnsurePasswordResetTokensSchemaAsync(connection);
        await using var userCommand = new NpgsqlCommand("SELECT id FROM users WHERE email = @email LIMIT 1", connection);
        userCommand.Parameters.AddWithValue("email", normalizedEmail);

        var userId = await userCommand.ExecuteScalarAsync();
        if (userId is not Guid id) return null;

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        await using var tokenCommand = new NpgsqlCommand(
            """
            INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
            VALUES (@id, @userId, @tokenHash, @expiresAt);
            """,
            connection);
        tokenCommand.Parameters.AddWithValue("id", Guid.NewGuid());
        tokenCommand.Parameters.AddWithValue("userId", id);
        tokenCommand.Parameters.AddWithValue("tokenHash", HashPassword(token, normalizedEmail));
        tokenCommand.Parameters.AddWithValue("expiresAt", DateTimeOffset.UtcNow.AddMinutes(30));
        await tokenCommand.ExecuteNonQueryAsync();

        return token;
    }


    public async Task<bool> CompletePasswordResetAsync(PasswordResetConfirmRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var tokenHash = HashPassword(request.Token.Trim(), normalizedEmail);
        var passwordHash = HashPassword(request.NewPassword.Trim(), normalizedEmail);

        await using var connection = await dataSource.OpenConnectionAsync();
        await EnsurePasswordResetTokensSchemaAsync(connection);
        await using var transaction = await connection.BeginTransactionAsync();

        await using var tokenCommand = new NpgsqlCommand(
            """
            SELECT reset_tokens.id, reset_tokens.user_id
            FROM password_reset_tokens reset_tokens
            INNER JOIN users ON users.id = reset_tokens.user_id
            WHERE users.email = @email
              AND reset_tokens.token_hash = @tokenHash
              AND reset_tokens.used_at IS NULL
              AND reset_tokens.expires_at > now()
            ORDER BY reset_tokens.created_at DESC
            LIMIT 1;
            """,
            connection,
            transaction);
        tokenCommand.Parameters.AddWithValue("email", normalizedEmail);
        tokenCommand.Parameters.AddWithValue("tokenHash", tokenHash);

        Guid tokenId;
        Guid userId;
        await using (var reader = await tokenCommand.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync()) return false;
            tokenId = reader.GetGuid(0);
            userId = reader.GetGuid(1);
        }

        await using var passwordCommand = new NpgsqlCommand(
            "UPDATE users SET password_hash = @passwordHash WHERE id = @userId;",
            connection,
            transaction);
        passwordCommand.Parameters.AddWithValue("passwordHash", passwordHash);
        passwordCommand.Parameters.AddWithValue("userId", userId);
        await passwordCommand.ExecuteNonQueryAsync();

        await using var usedCommand = new NpgsqlCommand(
            "UPDATE password_reset_tokens SET used_at = now() WHERE id = @tokenId;",
            connection,
            transaction);
        usedCommand.Parameters.AddWithValue("tokenId", tokenId);
        await usedCommand.ExecuteNonQueryAsync();

        await transaction.CommitAsync();
        return true;
    }
    public async Task<IReadOnlyCollection<LocalUser>> GetRegisteredUsersAsync()
    {
        var users = new List<LocalUser>();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            SELECT id, name, email, created_at
            FROM users
            ORDER BY name, email;
            """,
            connection);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            users.Add(new LocalUser(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetFieldValue<DateTimeOffset>(3)));
        }

        return users;
    }
    public async Task<HouseholdRecord?> GetHouseholdAsync(Guid userId)
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT id, owner_user_id, name, created_at FROM households WHERE owner_user_id = @userId LIMIT 1",
            connection);
        command.Parameters.AddWithValue("userId", userId);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        return ReadHousehold(reader);
    }

    public async Task<HouseholdRecord> CreateHouseholdAsync(CreateHouseholdRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO households (id, owner_user_id, name)
            VALUES (@id, @ownerUserId, @name)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, owner_user_id, name, created_at;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("ownerUserId", request.OwnerUserId);
        command.Parameters.AddWithValue("name", request.Name.Trim());

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        return ReadHousehold(reader);
    }

    public async Task<IReadOnlyCollection<HouseholdMemberRecord>> GetHouseholdMembersAsync(Guid householdId)
    {
        var members = new List<HouseholdMemberRecord>();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT id, household_id, user_id, name, email, role, created_at FROM household_members WHERE household_id = @householdId ORDER BY created_at",
            connection);
        command.Parameters.AddWithValue("householdId", householdId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) members.Add(ReadHouseholdMember(reader));
        return members;
    }

    public async Task<HouseholdMemberRecord> AddHouseholdMemberAsync(Guid householdId, CreateHouseholdMemberRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        var role = string.Equals(request.Role, "owner", StringComparison.OrdinalIgnoreCase) ? "owner" : "member";
        await using var connection = await dataSource.OpenConnectionAsync();

        LocalUser? registeredUser = null;
        if (request.UserId.HasValue)
        {
            await using var userCommand = new NpgsqlCommand(
                "SELECT id, name, email, created_at FROM users WHERE id = @userId LIMIT 1",
                connection);
            userCommand.Parameters.AddWithValue("userId", request.UserId.Value);
            await using var userReader = await userCommand.ExecuteReaderAsync();
            if (await userReader.ReadAsync())
            {
                registeredUser = new LocalUser(
                    userReader.GetGuid(0),
                    userReader.GetString(1),
                    userReader.GetString(2),
                    userReader.GetFieldValue<DateTimeOffset>(3));
            }

            await userReader.CloseAsync();
            if (registeredUser is null) throw new InvalidOperationException("UsuÃ¡rio cadastrado nÃ£o encontrado.");
        }

        var name = registeredUser?.Name ?? request.Name?.Trim();
        var email = registeredUser?.Email ?? request.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidOperationException("Informe um usuario cadastrado para adicionar ao grupo.");
        }

        await using var command = new NpgsqlCommand(
            """
            INSERT INTO household_members (id, household_id, user_id, name, email, role)
            VALUES (@id, @householdId, @userId, @name, @email, @role)
            ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role
            RETURNING id, household_id, user_id, name, email, role, created_at;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("householdId", householdId);
        command.Parameters.AddWithValue("userId", (object?)request.UserId ?? DBNull.Value);
        command.Parameters.AddWithValue("name", name);
        command.Parameters.AddWithValue("email", email);
        command.Parameters.AddWithValue("role", role);

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        return ReadHouseholdMember(reader);
    }

    public async Task<IReadOnlyCollection<Category>> GetCategoriesAsync(Guid userId)
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await EnsureDefaultCategoriesAsync(userId, connection);

        var categories = new List<Category>();
        await using var command = new NpgsqlCommand(
            "SELECT id, user_id, name, color, household_id FROM categories WHERE user_id = @userId ORDER BY name",
            connection);
        command.Parameters.AddWithValue("userId", userId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) categories.Add(ReadCategory(reader));
        return categories;
    }

    public async Task<Category> AddCategoryAsync(CreateCategoryRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO categories (id, user_id, name, color, household_id)
            VALUES (@id, @userId, @name, @color, @householdId)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, household_id = EXCLUDED.household_id
            RETURNING id, user_id, name, color, household_id;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("userId", request.UserId);
        command.Parameters.AddWithValue("name", request.Name.Trim());
        command.Parameters.AddWithValue("color", request.Color);
        command.Parameters.AddWithValue("householdId", (object?)request.HouseholdId ?? DBNull.Value);

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        return ReadCategory(reader);
    }

    public async Task<IReadOnlyCollection<TransactionRecord>> GetTransactionsAsync(Guid userId)
    {
        var transactions = new List<TransactionRecord>();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT id, user_id, kind, description, amount, category_id, occurred_at, created_at FROM transactions WHERE user_id = @userId ORDER BY occurred_at DESC, created_at DESC",
            connection);
        command.Parameters.AddWithValue("userId", userId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) transactions.Add(ReadTransaction(reader));
        return transactions;
    }

    public async Task<PagedTransactionsResponse> GetTransactionsPageAsync(Guid userId, int page, int pageSize, int? year, int? month)
    {
        var hasMonthFilter = year.HasValue && month.HasValue;
        var startDate = hasMonthFilter ? new DateOnly(year!.Value, month!.Value, 1) : default;
        var endDate = hasMonthFilter ? startDate.AddMonths(1) : default;
        var whereClause = hasMonthFilter
            ? "WHERE user_id = @userId AND occurred_at >= @startDate AND occurred_at < @endDate"
            : "WHERE user_id = @userId";

        await using var connection = await dataSource.OpenConnectionAsync();
        await using var countCommand = new NpgsqlCommand($"SELECT COUNT(*) FROM transactions {whereClause}", connection);
        countCommand.Parameters.AddWithValue("userId", userId);
        if (hasMonthFilter)
        {
            countCommand.Parameters.AddWithValue("startDate", startDate);
            countCommand.Parameters.AddWithValue("endDate", endDate);
        }

        var totalItems = Convert.ToInt32(await countCommand.ExecuteScalarAsync() ?? 0);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize));
        var currentPage = Math.Min(page, totalPages);
        var offset = (currentPage - 1) * pageSize;

        var transactions = new List<TransactionRecord>();
        await using var pageCommand = new NpgsqlCommand(
            $"""
            SELECT id, user_id, kind, description, amount, category_id, occurred_at, created_at
            FROM transactions
            {whereClause}
            ORDER BY occurred_at DESC, created_at DESC
            LIMIT @pageSize OFFSET @offset;
            """,
            connection);
        pageCommand.Parameters.AddWithValue("userId", userId);
        pageCommand.Parameters.AddWithValue("pageSize", pageSize);
        pageCommand.Parameters.AddWithValue("offset", offset);
        if (hasMonthFilter)
        {
            pageCommand.Parameters.AddWithValue("startDate", startDate);
            pageCommand.Parameters.AddWithValue("endDate", endDate);
        }

        await using var reader = await pageCommand.ExecuteReaderAsync();
        while (await reader.ReadAsync()) transactions.Add(ReadTransaction(reader));
        return new PagedTransactionsResponse(transactions, currentPage, pageSize, totalItems, totalPages);
    }

    public async Task<int> DeleteTransactionsAsync(Guid userId, IReadOnlyCollection<Guid> transactionIds)
    {
        var uniqueIds = transactionIds.Distinct().ToArray();
        if (uniqueIds.Length == 0) return 0;

        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "DELETE FROM transactions WHERE user_id = @userId AND id = ANY(@ids)",
            connection);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("ids", uniqueIds);
        return await command.ExecuteNonQueryAsync();
    }

    public async Task<TransactionRecord> AddTransactionAsync(CreateTransactionRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO transactions (id, user_id, kind, description, amount, category_id, occurred_at)
            VALUES (@id, @userId, @kind, @description, @amount, @categoryId, @occurredAt)
            ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, description = EXCLUDED.description, amount = EXCLUDED.amount, category_id = EXCLUDED.category_id, occurred_at = EXCLUDED.occurred_at
            RETURNING id, user_id, kind, description, amount, category_id, occurred_at, created_at;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("userId", request.UserId);
        command.Parameters.AddWithValue("kind", ToDbKind(request.Kind));
        command.Parameters.AddWithValue("description", request.Description.Trim());
        command.Parameters.AddWithValue("amount", request.Amount);
        command.Parameters.AddWithValue("categoryId", (object?)request.CategoryId ?? DBNull.Value);
        command.Parameters.AddWithValue("occurredAt", request.OccurredAt);

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        return ReadTransaction(reader);
    }

    public async Task<IReadOnlyCollection<Goal>> GetGoalsAsync(Guid userId)
    {
        var goals = new List<Goal>();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT id, user_id, kind, name, target_amount, current_amount, household_id FROM goals WHERE user_id = @userId ORDER BY name",
            connection);
        command.Parameters.AddWithValue("userId", userId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) goals.Add(ReadGoal(reader));
        return goals;
    }

    public async Task<Goal> AddGoalAsync(CreateGoalRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO goals (id, user_id, kind, name, target_amount, current_amount, household_id)
            VALUES (@id, @userId, @kind, @name, @targetAmount, @currentAmount, @householdId)
            ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name = EXCLUDED.name, target_amount = EXCLUDED.target_amount, current_amount = EXCLUDED.current_amount, household_id = EXCLUDED.household_id
            RETURNING id, user_id, kind, name, target_amount, current_amount, household_id;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("userId", request.UserId);
        command.Parameters.AddWithValue("kind", ToDbKind(request.Kind));
        command.Parameters.AddWithValue("name", request.Name.Trim());
        command.Parameters.AddWithValue("targetAmount", request.TargetAmount);
        command.Parameters.AddWithValue("currentAmount", request.CurrentAmount);
        command.Parameters.AddWithValue("householdId", (object?)request.HouseholdId ?? DBNull.Value);

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        return ReadGoal(reader);
    }



    public async Task DeleteGoalAsync(Guid userId, Guid goalId)
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "DELETE FROM goals WHERE id = @id AND user_id = @userId",
            connection);
        command.Parameters.AddWithValue("id", goalId);
        command.Parameters.AddWithValue("userId", userId);
        await command.ExecuteNonQueryAsync();
    }

    public async Task AddBudgetAsync(CreateBudgetRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO budgets (id, user_id, category_id, name, color, budget_kind, monthly_amount, limit_amount, allocation_mode, allocation_value, preset, is_automatic)
            VALUES (@id, @userId, @categoryId, @name, @color, @budgetKind, @monthlyAmount, @limitAmount, @allocationMode, @allocationValue, @preset, @isAutomatic)
            ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, color = EXCLUDED.color, budget_kind = EXCLUDED.budget_kind, monthly_amount = EXCLUDED.monthly_amount, limit_amount = EXCLUDED.limit_amount, allocation_mode = EXCLUDED.allocation_mode, allocation_value = EXCLUDED.allocation_value, preset = EXCLUDED.preset, is_automatic = EXCLUDED.is_automatic;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("userId", request.UserId);
        command.Parameters.AddWithValue("categoryId", request.CategoryId);
        command.Parameters.AddWithValue("name", request.Name.Trim());
        command.Parameters.AddWithValue("color", request.Color);
        command.Parameters.AddWithValue("budgetKind", string.IsNullOrWhiteSpace(request.BudgetKind) ? "expense" : request.BudgetKind.Trim());
        command.Parameters.AddWithValue("monthlyAmount", request.MonthlyAmount ?? request.LimitAmount);
        command.Parameters.AddWithValue("limitAmount", request.LimitAmount);
        command.Parameters.AddWithValue("allocationMode", request.AllocationMode.Trim());
        command.Parameters.AddWithValue("allocationValue", request.AllocationValue);
        command.Parameters.AddWithValue("preset", request.Preset.Trim());
        command.Parameters.AddWithValue("isAutomatic", request.IsAutomatic);
        await command.ExecuteNonQueryAsync();
    }

    public async Task DeleteBudgetAsync(Guid userId, Guid budgetId)
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "DELETE FROM budgets WHERE id = @id AND user_id = @userId",
            connection);
        command.Parameters.AddWithValue("id", budgetId);
        command.Parameters.AddWithValue("userId", userId);
        await command.ExecuteNonQueryAsync();
    }
    public async Task<IReadOnlyCollection<PredictableIncome>> GetPredictableIncomesAsync(Guid userId)
    {
        var incomes = new List<PredictableIncome>();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT id, user_id, description, amount, frequency FROM predictable_incomes WHERE user_id = @userId ORDER BY description",
            connection);
        command.Parameters.AddWithValue("userId", userId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) incomes.Add(ReadPredictableIncome(reader));
        return incomes;
    }

    public async Task<PredictableIncome> AddPredictableIncomeAsync(CreatePredictableIncomeRequest request)
    {
        var id = request.Id ?? Guid.NewGuid();
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO predictable_incomes (id, user_id, description, amount, frequency)
            VALUES (@id, @userId, @description, @amount, 'monthly')
            ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, amount = EXCLUDED.amount
            RETURNING id, user_id, description, amount, frequency;
            """,
            connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("userId", request.UserId);
        command.Parameters.AddWithValue("description", request.Description.Trim());
        command.Parameters.AddWithValue("amount", request.Amount);

        await using var reader = await command.ExecuteReaderAsync();
        await reader.ReadAsync();
        return ReadPredictableIncome(reader);
    }

    public async Task RecordSyncQueueItemAsync(Guid queueItemId, Guid userId, string entity, Guid entityId, string operation, string status)
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO sync_queue (id, user_id, entity, entity_id, operation, status)
            VALUES (@id, @userId, @entity, @entityId, @operation, @status)
            ON CONFLICT (id) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                entity = EXCLUDED.entity,
                entity_id = EXCLUDED.entity_id,
                operation = EXCLUDED.operation,
                status = EXCLUDED.status;
            """,
            connection);
        command.Parameters.AddWithValue("id", queueItemId);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("entity", entity);
        command.Parameters.AddWithValue("entityId", entityId);
        command.Parameters.AddWithValue("operation", operation);
        command.Parameters.AddWithValue("status", status);
        await command.ExecuteNonQueryAsync();
    }

    private static HouseholdRecord ReadHousehold(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetFieldValue<DateTimeOffset>(3));

    private static HouseholdMemberRecord ReadHouseholdMember(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetGuid(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetFieldValue<DateTimeOffset>(6));

    private static Category ReadCategory(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetGuid(4));

    private static TransactionRecord ReadTransaction(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetGuid(1),
        FromTransactionKind(reader.GetString(2)),
        reader.GetString(3),
        reader.GetDecimal(4),
        reader.IsDBNull(5) ? null : reader.GetGuid(5),
        reader.GetFieldValue<DateOnly>(6),
        reader.GetFieldValue<DateTimeOffset>(7));

    private static Goal ReadGoal(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), FromGoalKind(reader.GetString(2)), reader.GetString(3), reader.GetDecimal(4), reader.GetDecimal(5), reader.IsDBNull(6) ? null : reader.GetGuid(6));

    private static PredictableIncome ReadPredictableIncome(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetDecimal(3), reader.GetString(4));

    private async Task EnsureDefaultCategoriesAsync(Guid userId, NpgsqlConnection connection)
    {
        await using var countCommand = new NpgsqlCommand("SELECT COUNT(*) FROM categories WHERE user_id = @userId", connection);
        countCommand.Parameters.AddWithValue("userId", userId);
        var count = (long)(await countCommand.ExecuteScalarAsync() ?? 0L);
        if (count > 0) return;

        var defaults = new[]
        {
            ("Casa", "#176b5b"),
            ("AlimentaÃ§Ã£o", "#f97316"),
            ("Transporte", "#2563eb"),
            ("SaÃºde", "#dc2626"),
            ("Lazer", "#7c3aed")
        };

        foreach (var (name, color) in defaults)
        {
            await using var insertCommand = new NpgsqlCommand(
                "INSERT INTO categories (id, user_id, name, color) VALUES (@id, @userId, @name, @color)",
                connection);
            insertCommand.Parameters.AddWithValue("id", Guid.NewGuid());
            insertCommand.Parameters.AddWithValue("userId", userId);
            insertCommand.Parameters.AddWithValue("name", name);
            insertCommand.Parameters.AddWithValue("color", color);
            await insertCommand.ExecuteNonQueryAsync();
        }
    }


    private static async Task EnsurePasswordResetTokensSchemaAsync(NpgsqlConnection connection)
    {
        await using var command = new NpgsqlCommand(PasswordResetTokensSchemaSql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private const string PasswordResetTokensSchemaSql = """
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id, expires_at);
""";
    private static string HashPassword(string password, string normalizedEmail)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{normalizedEmail}:{password}"));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
    private static string ToDbKind(TransactionKind kind) => kind switch
    {
        TransactionKind.Income => "income",
        TransactionKind.FixedExpense => "fixed_expense",
        TransactionKind.VariableExpense => "variable_expense",
        _ => "variable_expense"
    };

    private static TransactionKind FromTransactionKind(string kind) => kind switch
    {
        "income" => TransactionKind.Income,
        "fixed_expense" => TransactionKind.FixedExpense,
        _ => TransactionKind.VariableExpense
    };

    private static string ToDbKind(GoalKind kind) => kind switch
    {
        GoalKind.Saving => "saving",
        GoalKind.Debt => "debt",
        _ => "saving"
    };

    private static GoalKind FromGoalKind(string kind) => kind == "debt" ? GoalKind.Debt : GoalKind.Saving;

    private const string SchemaSql = """
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
    id uuid PRIMARY KEY,
    household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'member')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id uuid NULL,
    name text NOT NULL,
    color text NOT NULL,
    CONSTRAINT fk_categories_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('income', 'fixed_expense', 'variable_expense')),
    description text NOT NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    category_id uuid NULL REFERENCES categories(id) ON DELETE SET NULL,
    occurred_at date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id uuid NULL,
    kind text NOT NULL CHECK (kind IN ('saving', 'debt')),
    name text NOT NULL,
    target_amount numeric(14, 2) NOT NULL CHECK (target_amount > 0),
    current_amount numeric(14, 2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_goals_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL,
    budget_kind text NOT NULL DEFAULT 'expense' CHECK (budget_kind IN ('income', 'expense')),
    monthly_amount numeric(14, 2) NOT NULL DEFAULT 1 CHECK (monthly_amount > 0),
    limit_amount numeric(14, 2) NOT NULL CHECK (limit_amount > 0),
    allocation_mode text NOT NULL CHECK (allocation_mode IN ('percentage', 'fixed', 'preset')),
    allocation_value numeric(14, 2) NOT NULL CHECK (allocation_value > 0),
    preset text NOT NULL,
    is_automatic boolean NOT NULL DEFAULT true,
    period text NOT NULL DEFAULT 'monthly',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS predictable_incomes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    frequency text NOT NULL CHECK (frequency = 'monthly')
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sync_queue (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity text NOT NULL,
    entity_id uuid NOT NULL,
    operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    status text NOT NULL CHECK (status IN ('pending', 'synced', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_households_owner ON households (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members (household_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text NULL;
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS user_id uuid NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS household_id uuid NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS household_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_info
        JOIN pg_attribute column_info
            ON column_info.attrelid = constraint_info.conrelid
            AND column_info.attnum = ANY (constraint_info.conkey)
        WHERE constraint_info.contype = 'f'
            AND constraint_info.conrelid = 'categories'::regclass
            AND constraint_info.confrelid = 'households'::regclass
            AND column_info.attname = 'household_id'
    ) THEN
        ALTER TABLE categories
            ADD CONSTRAINT fk_categories_household
            FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_info
        JOIN pg_attribute column_info
            ON column_info.attrelid = constraint_info.conrelid
            AND column_info.attnum = ANY (constraint_info.conkey)
        WHERE constraint_info.contype = 'f'
            AND constraint_info.conrelid = 'goals'::regclass
            AND constraint_info.confrelid = 'households'::regclass
            AND column_info.attname = 'household_id'
    ) THEN
        ALTER TABLE goals
            ADD CONSTRAINT fk_goals_household
            FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_transactions_user_month ON transactions (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories (household_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_household ON goals (household_id);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_kind text NOT NULL DEFAULT 'expense';
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS monthly_amount numeric(14, 2) NOT NULL DEFAULT 1;
UPDATE budgets SET monthly_amount = limit_amount WHERE monthly_amount = 1 AND limit_amount > 1;
CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets (category_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON sync_queue (user_id, status);
""";
}
public sealed record SyncHouseholdMemberPayload(Guid? Id, Guid HouseholdId, Guid? UserId, string? Name, string? Email, string Role);

public static class SyncPushProcessor
{
    private static readonly System.Text.Json.JsonSerializerOptions SyncJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public static async Task<SyncPushItemResult> ProcessSyncItemAsync(SyncPushItemRequest item, PostgresFinanceStore store)
    {
        try
        {
            var operation = item.Operation.ToLowerInvariant();

            switch (item.Entity)
            {
                case "household":
                    if (operation != "create") return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para household.");
                    await store.CreateHouseholdAsync(DeserializePayload<CreateHouseholdRequest>(item.Payload));
                    break;
                case "household_member":
                    if (operation != "create") return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para household_member.");
                    var memberRequest = DeserializePayload<SyncHouseholdMemberPayload>(item.Payload);
                    await store.AddHouseholdMemberAsync(memberRequest.HouseholdId, new CreateHouseholdMemberRequest(memberRequest.Id, memberRequest.UserId, memberRequest.Name, memberRequest.Email, memberRequest.Role));
                    break;
                case "category":
                    if (operation != "create") return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para category.");
                    await store.AddCategoryAsync(DeserializePayload<CreateCategoryRequest>(item.Payload));
                    break;
                case "transaction":
                    if (operation == "delete")
                    {
                        await store.DeleteTransactionsAsync(item.UserId, new[] { item.EntityId });
                        break;
                    }

                    if (operation == "create" || operation == "update")
                    {
                        await store.AddTransactionAsync(DeserializePayload<CreateTransactionRequest>(item.Payload));
                        break;
                    }

                    return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para transaction.");
                case "goal":
                    if (operation == "delete")
                    {
                        await store.DeleteGoalAsync(item.UserId, item.EntityId);
                        break;
                    }

                    if (operation == "create" || operation == "update")
                    {
                        await store.AddGoalAsync(DeserializePayload<CreateGoalRequest>(item.Payload));
                        break;
                    }

                    return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para metas.");
                case "budget":
                    if (operation == "delete")
                    {
                        await store.DeleteBudgetAsync(item.UserId, item.EntityId);
                        break;
                    }

                    if (operation == "create" || operation == "update")
                    {
                        await store.AddBudgetAsync(DeserializePayload<CreateBudgetRequest>(item.Payload));
                        break;
                    }

                    return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para orcamentos.");                case "predictable_income":
                    if (operation != "create") return await RecordSyncFailureAsync(item, store, $"Operacao '{item.Operation}' ainda nao suportada para predictable_income.");
                    await store.AddPredictableIncomeAsync(DeserializePayload<CreatePredictableIncomeRequest>(item.Payload));
                    break;
                default:
                    return await RecordSyncFailureAsync(item, store, $"Entidade '{item.Entity}' nÃ£o suportada pelo backend sync service.");
            }

            await store.RecordSyncQueueItemAsync(item.QueueItemId, item.UserId, item.Entity, item.EntityId, item.Operation, "synced");
            return new SyncPushItemResult(item.QueueItemId, "synced", null);
        }
        catch (Exception exception)
        {
            return await RecordSyncFailureAsync(item, store, exception.Message);
        }
    }

    private static async Task<SyncPushItemResult> RecordSyncFailureAsync(SyncPushItemRequest item, PostgresFinanceStore store, string message)
    {
        await store.RecordSyncQueueItemAsync(item.QueueItemId, item.UserId, item.Entity, item.EntityId, item.Operation, "failed");
        return new SyncPushItemResult(item.QueueItemId, "failed", message);
    }

    private static T DeserializePayload<T>(System.Text.Json.JsonElement payload)
    {
        var value = payload.Deserialize<T>(SyncJsonOptions);
        return value ?? throw new InvalidOperationException("Payload de sync vazio.");
    }
}














