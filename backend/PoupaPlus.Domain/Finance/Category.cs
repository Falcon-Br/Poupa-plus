namespace PoupaPlus.Domain.Finance;

public sealed record Category(
    Guid Id,
    Guid UserId,
    string Name,
    string Color,
    Guid? HouseholdId = null);
