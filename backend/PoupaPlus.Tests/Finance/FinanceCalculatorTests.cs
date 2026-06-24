using PoupaPlus.Domain.Finance;

namespace PoupaPlus.Tests.Finance;

public sealed class FinanceCalculatorTests
{
    private static readonly Guid UserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid FoodId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid HomeId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    private static readonly Category[] Categories =
    [
        new(FoodId, UserId, "Alimentacao", "#f97316"),
        new(HomeId, UserId, "Casa", "#176b5b")
    ];

    private static readonly TransactionRecord[] Transactions =
    [
        NewTransaction(TransactionKind.Income, "Salario", 5000m, null, new DateOnly(2026, 6, 3)),
        NewTransaction(TransactionKind.FixedExpense, "Aluguel", 1400m, HomeId, new DateOnly(2026, 6, 5)),
        NewTransaction(TransactionKind.VariableExpense, "Mercado", 420m, FoodId, new DateOnly(2026, 6, 8)),
        NewTransaction(TransactionKind.VariableExpense, "Lanche", 80m, FoodId, new DateOnly(2026, 6, 10)),
        NewTransaction(TransactionKind.Income, "Freela antigo", 700m, null, new DateOnly(2026, 5, 29))
    ];

    [Fact]
    public void SummarizeMonth_ReturnsIncomeExpensesAndBalanceForSelectedMonth()
    {
        var result = FinanceCalculator.SummarizeMonth(Transactions, 2026, 6);

        Assert.Equal(new MonthlySummary(5000m, 1900m, 3100m), result);
    }

    [Fact]
    public void SummarizeExpensesByCategory_GroupsMonthlyExpensesAndExcludesIncome()
    {
        var result = FinanceCalculator.SummarizeExpensesByCategory(Transactions, Categories, 2026, 6);

        Assert.Collection(
            result,
            item => Assert.Equal(new CategoryTotal(HomeId, "Casa", "#176b5b", 1400m), item),
            item => Assert.Equal(new CategoryTotal(FoodId, "Alimentacao", "#f97316", 500m), item));
    }

    [Fact]
    public void SummarizeExpensesByCategory_UsesFallbackForUncategorizedExpenses()
    {
        var uncategorized = NewTransaction(
            TransactionKind.VariableExpense,
            "Taxi",
            50m,
            null,
            new DateOnly(2026, 6, 12));

        var result = FinanceCalculator.SummarizeExpensesByCategory([uncategorized], Categories, 2026, 6);

        Assert.Collection(
            result,
            item => Assert.Equal(new CategoryTotal(null, "Sem categoria", "#9ca3af", 50m), item));
    }

    [Fact]
    public void ProjectNextMonth_UsesPredictableIncomeAndRecurringFixedExpenses()
    {
        PredictableIncome[] predictableIncomes =
        [
            new(Guid.NewGuid(), UserId, "Salario", 5200m, "monthly")
        ];

        var result = FinanceCalculator.ProjectNextMonth(predictableIncomes, Transactions);

        Assert.Equal(new MonthlySummary(5200m, 1400m, 3800m), result);
    }

    [Fact]
    public void GetGoalProgress_CapsProgressAtOneHundredPercent()
    {
        var goal = new Goal(
            Guid.NewGuid(),
            UserId,
            GoalKind.Saving,
            "Reserva",
            2000m,
            2400m);

        Assert.Equal(100, FinanceCalculator.GetGoalProgress(goal));
    }

    private static TransactionRecord NewTransaction(
        TransactionKind kind,
        string description,
        decimal amount,
        Guid? categoryId,
        DateOnly occurredAt)
    {
        return new TransactionRecord(
            Guid.NewGuid(),
            UserId,
            kind,
            description,
            amount,
            categoryId,
            occurredAt,
            DateTimeOffset.UtcNow);
    }
}
