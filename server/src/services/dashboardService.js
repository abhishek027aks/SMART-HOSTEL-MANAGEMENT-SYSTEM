const Bed = require("../models/Bed");
const Complaint = require("../models/Complaint");
const EntryExit = require("../models/EntryExit");
const Hostel = require("../models/Hostel");
const Outpass = require("../models/Outpass");
const Room = require("../models/Room");
const Student = require("../models/Student");

const activeFilter = { isDeleted: false };

const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
};

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getDashboardSummary = async (tenant = null, options = {}) => {
    const rangeDays = options?.rangeDays ?? 7;

    if (!Number.isInteger(rangeDays) || ![7, 30].includes(rangeDays)) {
        throw new TypeError("rangeDays must be 7 or 30.");
    }

    const { start, end } = getTodayRange();
    const trendStart = new Date(start);
    trendStart.setDate(trendStart.getDate() - rangeDays + 1);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const tenantFilter = tenant ? { hostelId: tenant.hostelId } : {};
    const recordFilter = { ...activeFilter, ...tenantFilter };
    const hostelFilter = tenant
        ? { _id: tenant.hostelId, ...activeFilter }
        : activeFilter;

    const todayFilter = {
        ...recordFilter,
        recordedAt: {
            $gte: start,
            $lt: end
        }
    };

    const studentPopulate = {
        path: "studentId",
        select: "name studentId",
        ...(tenant ? { match: { hostelId: tenant.hostelId } } : {})
    };

    const [
        totalHostels,
        totalStudents,
        activeStudents,
        totalRooms,
        vacantRooms,
        totalBeds,
        occupiedBeds,
        vacantBeds,
        reservedBeds,
        maintenanceBeds,
        todayEntry,
        todayExit,
        pendingOutpasses,
        openComplaints,
        recentStudents,
        recentEntryExit,
        recentComplaints,
        dailyGateRows
    ] = await Promise.all([
        Hostel.countDocuments(hostelFilter),
        Student.countDocuments(recordFilter),
        Student.countDocuments({ ...recordFilter, status: "ACTIVE" }),
        Room.countDocuments(recordFilter),
        Room.countDocuments({ ...recordFilter, status: "AVAILABLE" }),
        Bed.countDocuments(recordFilter),
        Bed.countDocuments({ ...recordFilter, status: "OCCUPIED" }),
        Bed.countDocuments({ ...recordFilter, status: "AVAILABLE" }),
        Bed.countDocuments({ ...recordFilter, status: "RESERVED" }),
        Bed.countDocuments({ ...recordFilter, status: "MAINTENANCE" }),
        EntryExit.countDocuments({ ...todayFilter, type: "ENTRY" }),
        EntryExit.countDocuments({ ...todayFilter, type: "EXIT" }),
        Outpass.countDocuments({ ...recordFilter, status: { $in: ["PENDING", "PENDING_PARENT", "PENDING_FINAL"] } }),
        Complaint.countDocuments({ ...recordFilter, status: { $ne: "RESOLVED" } }),
        Student.find(recordFilter)
            .select("_id name studentId roomId status")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        EntryExit.find(recordFilter)
            .select("_id studentId type recordedAt")
            .populate(studentPopulate)
            .sort({ recordedAt: -1 })
            .limit(5)
            .lean(),
        Complaint.find(recordFilter)
            .select("_id title category priority studentId")
            .populate(studentPopulate)
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        EntryExit.aggregate([
            {
                $match: {
                    ...recordFilter,
                    recordedAt: {
                        $gte: trendStart,
                        $lt: end
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$recordedAt",
                            timezone: timeZone
                        }
                    },
                    entries: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "ENTRY"] }, 1, 0]
                        }
                    },
                    exits: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "EXIT"] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ])
    ]);

    const gateRowsByDate = new Map(
        dailyGateRows.map((row) => [row._id, row])
    );

    const dailyGateActivity = Array.from({ length: rangeDays }, (_, index) => {
        const date = new Date(trendStart);
        date.setDate(trendStart.getDate() + index);

        const key = formatLocalDate(date);
        const row = gateRowsByDate.get(key);

        return {
            date: key,
            entries: Number(row?.entries || 0),
            exits: Number(row?.exits || 0)
        };
    });

    return {
        counts: {
            totalHostels,
            totalStudents,
            activeStudents,
            inactiveStudents: totalStudents - activeStudents,
            totalRooms,
            vacantRooms,
            totalBeds,
            occupiedBeds,
            vacantBeds,
            reservedBeds,
            maintenanceBeds,
            todayEntry,
            todayExit,
            pendingOutpasses,
            openComplaints
        },
        recentStudents,
        recentEntryExit,
        recentComplaints,
        analytics: {
            rangeDays,
            dailyGateActivity
        }
    };
};

module.exports = {
    getDashboardSummary
};