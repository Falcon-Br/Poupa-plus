namespace PoupaPlus.Domain.Finance;

public sealed record PredictableIncome(
    Guid Id,
    Guid UserId,
    string Description,
    decimal Amount,
    string Frequency);
