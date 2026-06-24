namespace PoupaPlus.Domain.Finance;

public sealed record Goal(
    Guid Id,
    Guid UserId,
    GoalKind Kind,
    string Name,
    decimal TargetAmount,
    decimal CurrentAmount,
    Guid? HouseholdId = null);
