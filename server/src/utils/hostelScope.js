const hostelScope = (req, criteria = {}) => {
    if (!req.tenant?.hostelId) {
        throw new Error("A verified hostel tenant context is required to build this query.");
    }

    return {
        ...criteria,
        hostelId: req.tenant.hostelId
    };
};

module.exports = hostelScope;
