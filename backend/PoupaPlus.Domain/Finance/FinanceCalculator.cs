namespace PoupaPlus.Domain.Finance;

public static class FinanceCalculator
{
    private const string UncategorizedName = "Sem categoria";
    private const string UncategorizedColor = "#9ca3af";

    public static MonthlySummary SummarizeMonth(
        IEnumerable<TransactionRecord> transactions,
        int year,
        int month)
    {
        var monthly = transactions
            .Where(transaction => transaction.OccurredAt.Year == year && transaction.OccurredAt.Month == month)
            .ToArray();

        var income = monthly
            .Where(transaction => transaction.Kind is TransactionKind.Income)
            .Sum(transaction => transaction.Amount);

        var expenses = monthly
            .Where(IsExpense)
            .Sum(transaction => transaction.Amount);

        return new MonthlySummary(income, expenses, income - expenses);
    }

    public static IReadOnlyCollection<CategoryTotal> SummarizeExpensesByCategory(
        IEnumerable<TransactionRecord> transactions,
        IEnumerable<Category> categories,
        int year,
        int month)
    {
        var categoryById = categories.ToDictionary(category => category.Id);

        return transactions
            .Where(transaction => transaction.OccurredAt.Year == year && transaction.OccurredAt.Month == month)
            .Where(IsExpense)
            .GroupBy(transaction => transaction.CategoryId)
            .Select(group =>
            {
                var category = group.Key is Guid categoryId && categoryById.TryGetValue(categoryId, out var found)
                    ? found
                    : null;

                return new CategoryTotal(
                    category?.Id,
                    category?.Name ?? UncategorizedName,
                    category?.Color ?? UncategorizedColor,
                    group.Sum(transaction => transaction.Amount));
            })
            .OrderByDescending(total => total.Amount)
            .ToArray();
    }

    public static MonthlySummary ProjectNextMonth(
        IEnumerable<PredictableIncome> predictableIncomes,
        IEnumerable<TransactionRecord> transactions)
    {
        var income = predictableIncomes.Sum(item => item.Amount);
        var fixedExpenses = transactions
            .Where(transaction => transaction.Kind is TransactionKind.FixedExpense)
            .Sum(transaction => transaction.Amount);

        return new MonthlySummary(income, fixedExpenses, income - fixedExpenses);
    }

    public static int GetGoalProgress(Goal goal)
    {
        if (goal.TargetAmount <= 0)
        {
            return 0;
        }

        var percentage = decimal.ToInt32(Math.Round(goal.CurrentAmount / goal.TargetAmount * 100, MidpointRounding.AwayFromZero));
        return Math.Clamp(percentage, 0, 100);
    }

    private static bool IsExpense(TransactionRecord transaction)
    {
        return transaction.Kind is TransactionKind.FixedExpense or TransactionKind.VariableExpense;
    }
}
