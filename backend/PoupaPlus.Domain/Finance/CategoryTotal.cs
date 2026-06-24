namespace PoupaPlus.Domain.Finance;

public sealed record CategoryTotal(Guid? CategoryId, string Name, string Color, decimal Amount);
