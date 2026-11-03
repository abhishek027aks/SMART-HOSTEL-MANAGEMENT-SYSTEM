# SMART HOSTEL MANAGEMENT SYSTEM

## Project Development Rules

1. All project creation, modification, configuration, installation and verification must be performed through PowerShell/Terminal.

2. No manual GUI editing of project files.

3. No fake, dummy or placeholder business data.

4. No hardcoded student, hostel, room, bed, fee, complaint, notice, notification or other business records.

5. Real application data must come from the backend and MongoDB.

6. Backend security is authoritative. Frontend role hiding is not considered security.

7. Hostel-scoped records must be protected by hostelId and backend tenant authorization.

8. Important records must use status/active/inactive or soft-delete mechanisms where appropriate so historical records are preserved.

9. Every feature must be implemented and verified before moving to the next feature.

10. Every file must have a real purpose. Unnecessary files must not be created.

11. No phase may be skipped.

12. No next sub-phase may start until the current sub-phase is completely verified.

13. No next phase may start until the current phase passes its complete A-to-Z verification.

14. Errors must be fixed before continuing.

15. Every API must be tested after implementation.

16. Authentication and authorization must be tested from the backend.

17. Multi-hostel data isolation must be tested.

18. Database changes must be performed through controlled terminal/database commands or application code.

19. Existing data must never be deleted without explicit confirmation.

20. Production secrets must not be committed to Git.

21. Environment variables must be used for secrets and environment-specific configuration.

22. The project must be developed from a clean baseline.

23. Every completed phase must have a documented verification result.

24. The final system must be tested end-to-end before deployment.

## Development Order

Phase 00 -> Phase 01 -> Phase 02 -> ... -> Phase 26

Within every phase:

01 -> 02 -> 03 -> ... -> final step

A failed step blocks the next step.

A failed phase blocks the next phase.
