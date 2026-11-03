const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const googleOAuthClient = new OAuth2Client();

const User = require("../models/User");
const Hostel = require("../models/Hostel");
const HostelMembership = require("../models/HostelMembership");
const Student = require("../models/Student");
const ROLES = require("../constants/roles");
const config = require("../config");
const { hashPassword, verifyPassword } = require("../utils/password");
const { signAccessToken } = require("../utils/token");
const { savePhotoBuffer, removeStoredPhoto } = require("../middleware/photoUpload");

const invalidCredentials = (res) => res.status(401).json({
    status: "error",
    message: "Invalid credentials"
});

const conflict = (res, message) => res.status(409).json({
    status: "error",
    message
});

const asString = (value, maxLength = 256) => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) {
        return null;
    }

    return trimmed;
};

const publicUser = (user, hostelId = null, studentId = null) => ({
    id: String(user._id),
    name: user.name,
    photoUrl: user.photoUrl || "",
    email: user.email || "",
    mobile: user.mobile || "",
    role: user.role,
    hostelId,
    studentId
});

const normalizeRegistrationPayload = (body) => {
    const name = asString(body?.name, 128);
    const email = asString(body?.email, 254);
    const mobile = asString(body?.mobile, 32);
    const password = typeof body?.password === "string" ? body.password : "";
    const hostelName = asString(body?.hostelName, 128);
    const hostelCode = asString(body?.hostelCode, 64);
    const accessCode = asString(body?.accessCode, 64);
    const contact = asString(body?.contact, 64);
    const city = asString(body?.city, 128);
    const state = asString(body?.state, 128);
    const address = asString(body?.address, 512);
    const pincode = asString(body?.pincode, 24);
    const photoUrl = body?.photoUrl === undefined || body.photoUrl === ""
        ? ""
        : asString(body.photoUrl, 2048);
    const galleryImages = body?.galleryImages === undefined
        ? []
        : Array.isArray(body.galleryImages) && body.galleryImages.length <= 8
            ? body.galleryImages.map((value) => asString(value, 2048))
            : null;
    const totalRooms = body?.totalRooms === undefined || body.totalRooms === "" ? 0 : Number(body.totalRooms);
    const totalBeds = body?.totalBeds === undefined || body.totalBeds === "" ? 0 : Number(body.totalBeds);
    const bedsPerRoom = body?.bedsPerRoom === undefined || body.bedsPerRoom === "" ? 0 : Number(body.bedsPerRoom);
    const roomTypes = Array.isArray(body?.roomTypes)
        ? body.roomTypes
            .filter((value) => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, 8)
        : [];

    const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const mobileDigits = mobile ? mobile.replace(/\D/g, "").length : 0;
    const validMobile = mobile &&
        /^\+?[0-9][0-9\s()-]{5,30}$/.test(mobile) &&
        mobileDigits >= 7 &&
        mobileDigits <= 15;
    const contactDigits = contact ? contact.replace(/\D/g, "").length : 0;
    const validContact = !body?.contact || (
        contact &&
        /^\+?[0-9][0-9\s()-]{5,30}$/.test(contact) &&
        contactDigits >= 7 &&
        contactDigits <= 15
    );
    const validHostelEmail = !body?.hostelEmail || (
        typeof body.hostelEmail === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.hostelEmail.trim())
    );
    const validImageUrl = (value) => {
        if (value === "") {
            return true;
        }
        if (typeof value !== "string") {
            return false;
        }
        try {
            const url = new URL(value);
            return url.protocol === "https:" || url.protocol === "http:";
        } catch {
            return false;
        }
    };
    const validRoomSetup = [totalRooms, totalBeds, bedsPerRoom].every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 100000
    );

    if (
        !name || !validEmail || !validMobile ||
        password.length < 8 || password.length > 1024 ||
        !hostelName || !hostelCode || !accessCode ||
        !/^[A-Z0-9_-]{3,64}$/.test(hostelCode.toUpperCase()) ||
        !/^[A-Z0-9_-]{4,64}$/.test(accessCode.toUpperCase()) ||
        !validHostelEmail || !validContact || !validImageUrl(photoUrl) ||
        !Array.isArray(galleryImages) || galleryImages.some((value) => !value || !validImageUrl(value)) ||
        !validRoomSetup
    ) {
        return null;
    }

    const normalizedRoomSetup = {
        totalRooms,
        totalBeds,
        bedsPerRoom,
        roomTypes
    };

    return {
        name,
        email: email.toLowerCase(),
        mobile,
        password,
        hostelName,
        hostelCode: hostelCode.toUpperCase(),
        accessCode: accessCode.toUpperCase(),
        contact: contact || mobile,
        city: city || "",
        state: state || "",
        address: address || "",
        pincode: pincode || "",
        photoUrl: photoUrl || "",
        galleryImages,
        roomSetup: normalizedRoomSetup,
        hostelEmail: typeof body?.hostelEmail === "string" ? body.hostelEmail.trim().toLowerCase() : ""
    };
};

const registerOwner = async (req, res, next) => {
    const payload = normalizeRegistrationPayload(req.body || {});
    if (!payload) {
        return res.status(400).json({
            status: "error",
            message: "Provide valid owner profile details plus hostel registration details. Password must be at least 8 characters."
        });
    }

    const googleCredential = asString(req.body?.googleCredential, 8192);
    if (!googleCredential) {
        return res.status(400).json({
            status: "error",
            message: "Verify the owner's Google account before registration."
        });
    }

    if (!config.googleClientId) {
        return res.status(503).json({
            status: "error",
            message: "Google Sign-In is not configured on the server."
        });
    }

    let googlePayload;
    try {
        const ticket = await googleOAuthClient.verifyIdToken({
            idToken: googleCredential,
            audience: config.googleClientId
        });
        googlePayload = ticket.getPayload();
    } catch {
        return invalidCredentials(res);
    }

    if (
        !googlePayload ||
        typeof googlePayload.email !== "string" ||
        googlePayload.email_verified !== true ||
        typeof googlePayload.sub !== "string" ||
        !googlePayload.sub
    ) {
        return invalidCredentials(res);
    }

    const verifiedOwnerEmail = googlePayload.email.trim().toLowerCase();
    if (verifiedOwnerEmail !== payload.email) {
        return res.status(400).json({
            status: "error",
            message: "The verified Google email must match the owner email entered in the form."
        });
    }

    const session = await mongoose.startSession();
    const storedGalleryPhotos = [];

    try {
        for (const file of req.files || []) {
            storedGalleryPhotos.push(
                await savePhotoBuffer(file.mimetype, file.buffer, { publicGallery: true })
            );
        }

        let createdOwner;
        let createdHostel;

        await session.withTransaction(async () => {
            const ownerExists = await User.findOne({
                email: payload.email,
                isDeleted: { $ne: true }
            }, null, { session });
            if (ownerExists) {
                throw Object.assign(new Error("An account with that email already exists."), { statusCode: 409 });
            }

            const mobileTaken = await User.findOne({
                mobile: payload.mobile,
                isDeleted: { $ne: true }
            }, null, { session });
            if (mobileTaken) {
                throw Object.assign(new Error("An account with that mobile number already exists."), { statusCode: 409 });
            }

            const hostelCodeTaken = await Hostel.findOne({
                hostelCode: payload.hostelCode,
                isDeleted: { $ne: true }
            }, null, { session });
            if (hostelCodeTaken) {
                throw Object.assign(new Error("That hostel code is already in use."), { statusCode: 409 });
            }

            const accessCodeTaken = await Hostel.findOne({
                accessCode: payload.accessCode,
                isDeleted: { $ne: true }
            }, null, { session });
            if (accessCodeTaken) {
                throw Object.assign(new Error("That hostel access code is already in use."), { statusCode: 409 });
            }

            const passwordHash = await hashPassword(payload.password);

            createdOwner = new User({
                name: payload.name,
                email: payload.email,
                mobile: payload.mobile,
                passwordHash,
                googleSub: googlePayload.sub,
                googleVerifiedAt: new Date(),
                googleVerificationRequired: false,
                role: ROLES.OWNER,
                status: "ACTIVE",
                hostelId: null,
                isDeleted: false
            });

            await createdOwner.save({ session });

            createdHostel = new Hostel({
                hostelCode: payload.hostelCode,
                accessCode: payload.accessCode,
                name: payload.hostelName,
                photoUrl: payload.photoUrl || "",
                galleryImages: [
                    ...(payload.galleryImages || []),
                    ...storedGalleryPhotos.map((photo) => photo.photoUrl)
                ],
                address: payload.address,
                city: payload.city,
                state: payload.state,
                pincode: payload.pincode,
                contact: payload.contact,
                email: payload.hostelEmail,
                roomSetup: payload.roomSetup,
                ownerId: createdOwner._id,
                status: "ACTIVE",
                isDeleted: false
            });

            await createdHostel.save({ session });

            createdOwner.hostelId = createdHostel._id;
            await createdOwner.save({ session });

            const membership = new HostelMembership({
                userId: createdOwner._id,
                hostelId: createdHostel._id,
                role: ROLES.OWNER,
                status: "ACTIVE",
                assignedBy: createdOwner._id,
                isDeleted: false
            });

            await membership.save({ session });
        });

        const account = publicUser(createdOwner, String(createdHostel._id));
        const token = signAccessToken(account, config.jwtSecret);

        return res.status(201).json({
            status: "success",
            data: {
                token,
                user: account,
                hostel: {
                    id: String(createdHostel._id),
                    hostelCode: createdHostel.hostelCode,
                    accessCode: createdHostel.accessCode,
                    name: createdHostel.name
                }
            }
        });
    } catch (error) {
        await Promise.all(storedGalleryPhotos.map((photo) =>
            removeStoredPhoto(photo).catch(() => undefined)
        ));

        if (error?.statusCode === 409) {
            return conflict(res, error.message);
        }

        if (error?.code === 11000) {
            return conflict(res, "A conflicting hostel or account record already exists.");
        }

        return next(error);
    } finally {
        await session.endSession();
    }
};

const login = async (req, res, next) => {
    const { identifier, password, accessCode, hostelId: requestedHostelId, role: requestedRole } = req.body || {};
    if (
        typeof identifier !== "string" || !identifier.trim() || identifier.trim().length > 254 ||
        typeof password !== "string" || password.length < 1 || password.length > 1024 ||
        (accessCode !== undefined && (typeof accessCode !== "string" || !accessCode.trim() || accessCode.trim().length > 128)) ||
        (requestedHostelId !== undefined && (typeof requestedHostelId !== "string" || !requestedHostelId.trim() || requestedHostelId.trim().length > 64)) ||
        (requestedRole !== undefined && !Object.values(ROLES).includes(requestedRole))
    ) {
        return res.status(400).json({
            status: "error",
            message: "Provide a valid identifier and password; student login also requires a hostel access code."
        });
    }

    try {
        let user;
        let studentId = null;
        let accessCodeHostelId = null;

        if (accessCode !== undefined) {
            const hostel = await Hostel.findOne({
                accessCode: accessCode.trim(),
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("_id").lean();
            if (hostel) {
                accessCodeHostelId = String(hostel._id);
                const studentRecord = await Student.findOne({
                    hostelId: hostel._id,
                    studentId: identifier.trim(),
                    status: "ACTIVE",
                    isDeleted: { $ne: true }
                }).select("userId studentId").lean();

                if (studentRecord && studentRecord.userId) {
                    user = await User.findOne({
                        _id: studentRecord.userId,
                        hostelId: hostel._id,
                        role: ROLES.STUDENT,
                        status: "ACTIVE",
                        isDeleted: { $ne: true }
                    });
                    studentId = studentRecord.studentId;
                }
            }
        } else {
            const normalizedIdentifier = identifier.trim();
            const matches = await User.find({
                $or: [
                    { email: normalizedIdentifier.toLowerCase() },
                    { mobile: normalizedIdentifier }
                ],
                isDeleted: { $ne: true }
            }).limit(2);

            if (matches.length === 1) {
                user = matches[0];
            }
        }

        if (!user) {
            return invalidCredentials(res);
        }

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches || user.status !== "ACTIVE" || user.isDeleted || user.googleVerificationRequired) {
            return invalidCredentials(res);
        }
        if (requestedRole && user.role !== requestedRole) {
            return invalidCredentials(res);
        }
        if (accessCodeHostelId && requestedHostelId && requestedHostelId.trim() !== accessCodeHostelId) {
            return invalidCredentials(res);
        }

        let selectedHostelId = null;
        if (user.role !== ROLES.SYSTEM_ADMIN) {
            const memberships = await HostelMembership.find({
                userId: user._id,
                role: user.role,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("hostelId").lean();
            const memberHostelIds = [...new Set(memberships.map((membership) => String(membership.hostelId)))];
            const activeHostels = await Hostel.find({
                _id: { $in: memberHostelIds },
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("_id").lean();
            const activeMemberships = new Set(activeHostels.map((hostel) => String(hostel._id)));

            if (accessCodeHostelId && !activeMemberships.has(accessCodeHostelId)) {
                return invalidCredentials(res);
            }

            const requestedId = requestedHostelId?.trim() || accessCodeHostelId || null;
            if (requestedId && !activeMemberships.has(requestedId)) {
                return invalidCredentials(res);
            }

            if (requestedId) {
                selectedHostelId = requestedId;
            } else {
                const primaryHostelId = user.hostelId ? String(user.hostelId) : null;
                if (primaryHostelId && activeMemberships.has(primaryHostelId)) {
                    selectedHostelId = primaryHostelId;
                } else if (activeMemberships.size > 0) {
                    selectedHostelId = [...activeMemberships].sort()[0];
                } else {
                    return invalidCredentials(res);
                }
            }
        } else if (requestedHostelId) {
            const activeHostel = await Hostel.findOne({
                _id: requestedHostelId.trim(),
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("_id").lean();
            if (!activeHostel) {
                return invalidCredentials(res);
            }
            selectedHostelId = String(activeHostel._id);
        }

        const account = publicUser(user, selectedHostelId, studentId);
        const token = signAccessToken(account, config.jwtSecret);

        return res.status(200).json({
            status: "success",
            data: { token, user: account }
        });
    } catch (error) {
        return next(error);
    }
};

const googleLogin = async (req, res, next) => {
    const body = req.body || {};
    const credential = asString(body.credential, 8192);
    const requestedRole = asString(body.role, 32);
    const allowedRoles = [
        ROLES.OWNER,
        ROLES.WARDEN,
        ROLES.GUARD,
        ROLES.STUDENT,
        ROLES.PARENT
    ];

    if (!credential || !allowedRoles.includes(requestedRole)) {
        return res.status(400).json({
            status: "error",
            message: "A valid Google credential and assigned SHMS role are required."
        });
    }

    if (!config.googleClientId) {
        return res.status(503).json({
            status: "error",
            message: "Google Sign-In is not configured on the server."
        });
    }

    let googlePayload;
    try {
        const ticket = await googleOAuthClient.verifyIdToken({
            idToken: credential,
            audience: config.googleClientId
        });
        googlePayload = ticket.getPayload();
    } catch {
        return invalidCredentials(res);
    }

    if (
        !googlePayload ||
        typeof googlePayload.email !== "string" ||
        googlePayload.email_verified !== true
    ) {
        return invalidCredentials(res);
    }

    const verifiedEmail = googlePayload.email.trim().toLowerCase();

    try {
        let user = null;
        let studentId = null;
        let accessCodeHostelId = null;

        if (requestedRole === ROLES.STUDENT) {
            const identifier = asString(body.identifier, 128);
            const accessCode = asString(body.accessCode, 64);

            if (!identifier || !accessCode) {
                return res.status(400).json({
                    status: "error",
                    message: "Student ID and hostel access code are required for student Google login."
                });
            }

            const hostel = await Hostel.findOne({
                accessCode: accessCode.toUpperCase(),
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }).select("_id").lean();

            if (hostel) {
                accessCodeHostelId = String(hostel._id);

                const studentRecord = await Student.findOne({
                    hostelId: hostel._id,
                    studentId: identifier.trim(),
                    status: "ACTIVE",
                    isDeleted: { $ne: true }
                }).select("userId studentId").lean();

                if (studentRecord?.userId) {
                    user = await User.findOne({
                        _id: studentRecord.userId,
                        hostelId: hostel._id,
                        email: verifiedEmail,
                        role: ROLES.STUDENT,
                        status: "ACTIVE",
                        isDeleted: { $ne: true }
                    });

                    if (user) studentId = studentRecord.studentId;
                }
            }
        } else {
            user = await User.findOne({
                email: verifiedEmail,
                role: requestedRole,
                status: "ACTIVE",
                isDeleted: { $ne: true }
            });
        }

        // Google login never creates an account or grants a new role.
        if (!user) return invalidCredentials(res);
        if (user.googleSub && user.googleSub !== googlePayload.sub) {
            return invalidCredentials(res);
        }

        const memberships = await HostelMembership.find({
            userId: user._id,
            role: user.role,
            status: "ACTIVE",
            isDeleted: { $ne: true }
        }).select("hostelId").lean();

        const memberHostelIds = [
            ...new Set(memberships.map((membership) => String(membership.hostelId)))
        ];

        const activeHostels = await Hostel.find({
            _id: { $in: memberHostelIds },
            status: "ACTIVE",
            isDeleted: { $ne: true }
        }).select("_id").lean();

        const activeMemberships = new Set(
            activeHostels.map((hostel) => String(hostel._id))
        );

        if (
            activeMemberships.size === 0 ||
            (accessCodeHostelId && !activeMemberships.has(accessCodeHostelId))
        ) {
            return invalidCredentials(res);
        }

        user.googleSub = googlePayload.sub;
        user.googleVerifiedAt = new Date();
        user.googleVerificationRequired = false;
        await user.save();

        let selectedHostelId = null;

        if (accessCodeHostelId) {
            selectedHostelId = accessCodeHostelId;
        } else {
            const primaryHostelId = user.hostelId ? String(user.hostelId) : null;

            if (primaryHostelId && activeMemberships.has(primaryHostelId)) {
                selectedHostelId = primaryHostelId;
            } else {
                selectedHostelId = [...activeMemberships].sort()[0];
            }
        }

        const account = publicUser(user, selectedHostelId, studentId);
        const token = signAccessToken(account, config.jwtSecret);

        return res.status(200).json({
            status: "success",
            data: { token, user: account }
        });
    } catch (error) {
        return next(error);
    }
};
const listAccessibleHostels = async (req, res, next) => {
    try {
        const isSystemAdmin = req.auth?.role === ROLES.SYSTEM_ADMIN;

        const filter = isSystemAdmin
            ? {
                status: "ACTIVE",
                isDeleted: { $ne: true }
            }
            : {
                _id: { $in: req.auth?.memberships || [] },
                status: "ACTIVE",
                isDeleted: { $ne: true }
            };

        const hostels = await Hostel.find(filter)
            .select("_id name hostelCode city state")
            .sort({ name: 1, _id: 1 })
            .lean();

        return res.status(200).json({
            status: "success",
            data: {
                items: hostels.map((hostel) => ({
                    ...hostel,
                    _id: String(hostel._id)
                }))
            }
        });
    } catch (error) {
        return next(error);
    }
};
const getCurrentUser = (req, res) => res.status(200).json({
    status: "success",
    data: { user: req.auth }
});

const updateCurrentOwner = async (req, res, next) => {
    if (req.auth?.role !== ROLES.OWNER) {
        return res.status(403).json({ status: "error", message: "Only the hostel owner can update this profile." });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ status: "error", message: "A JSON object is required." });
    }
    const unknown = Object.keys(body).filter((key) => !["name", "photoUrl"].includes(key));
    if (unknown.length) return res.status(400).json({ status: "error", message: `Unsupported field: ${unknown[0]}.` });
    const name = body.name === undefined ? undefined : asString(body.name, 128);
    const photoUrl = body.photoUrl === undefined ? undefined : body.photoUrl;
    if (body.name !== undefined && !name) return res.status(400).json({ status: "error", message: "name must contain 1 to 128 characters." });
    if (photoUrl !== undefined && (typeof photoUrl !== "string" || photoUrl.length > 2048 || (photoUrl && !/^\/api\/uploads\/photos\/[a-f\d-]{36}\.(?:jpg|png|webp)$/i.test(photoUrl)))) {
        return res.status(400).json({ status: "error", message: "photoUrl must reference an uploaded owner photo." });
    }
    if (name === undefined && photoUrl === undefined) return res.status(400).json({ status: "error", message: "Provide a profile field to update." });
    try {
        const user = await User.findOne({ _id: req.auth.id, role: ROLES.OWNER, status: "ACTIVE", isDeleted: { $ne: true } });
        if (!user) return res.status(404).json({ status: "error", message: "Owner account not found." });
        if (name !== undefined) user.name = name;
        if (photoUrl !== undefined) user.photoUrl = photoUrl;
        await user.save();
        return res.status(200).json({ status: "success", data: { user: publicUser(user, req.auth.hostelId) } });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    googleLogin,
    listAccessibleHostels,
    getCurrentUser,
    login,
    registerOwner,
    updateCurrentOwner
};
