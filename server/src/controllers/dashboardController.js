const dashboardService = require("../services/dashboardService");

const getSummary = async (req, res, next) => {
    try {
        const rawRangeDays = req.query?.rangeDays;
        let rangeDays = 7;

        if (rawRangeDays !== undefined) {
            if (rawRangeDays !== "7" && rawRangeDays !== "30") {
                res.status(400).json({
                    status: "error",
                    message: "rangeDays must be 7 or 30."
                });
                return;
            }

            rangeDays = Number(rawRangeDays);
        }

        const summary = await dashboardService.getDashboardSummary(
            req.tenant,
            { rangeDays }
        );

        res.status(200).json({
            status: "success",
            data: summary
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSummary
};
