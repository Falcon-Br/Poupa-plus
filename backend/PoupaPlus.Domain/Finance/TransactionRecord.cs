namespace PoupaPlus.Domain.Finance;

public sealed record TransactionRecord(
    Guid Id,
    Guid UserId,
    TransactionKind Kind,
    string Description,
    decimal Amount,
    Guid? CategoryId,
    DateOnly OccurredAt,
    DateTimeOffset CreatedAt);
