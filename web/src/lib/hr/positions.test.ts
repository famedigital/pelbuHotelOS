import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findStaffPosition,
  positionDeskAssignment,
  positionsForDepartment,
} from "./positions";

describe("department positions", () => {
  it("keeps F&B, front office, and housekeeping supervisors on role screens", () => {
    const cases = [
      ["F&B", "Supervisor", "fnb"],
      ["F&B", "Banquet supervisor", "fnb"],
      ["Front office", "Supervisor", "front_desk"],
      ["Housekeeping", "Supervisor", "hk"],
      ["Housekeeping", "Floor supervisor", "hk"],
    ] as const;
    for (const [department, title, deskRole] of cases) {
      const position = findStaffPosition(department, title);
      assert.ok(position, `${department} ${title}`);
      assert.equal(position.accessLevel, "supervisor");
      assert.equal(position.deskRole, deskRole);
      assert.equal(position.modules, "defaults");
      const assignment = positionDeskAssignment(position);
      assert.equal(assignment.canAccessDesk, true);
      assert.equal(assignment.deskRole, deskRole);
      assert.equal(assignment.deskModuleKeys, null);
    }
  });

  it("lists a position set for every default department", () => {
    for (const department of [
      "Front office",
      "Rooms",
      "Housekeeping",
      "F&B",
      "Kitchen",
      "Spa",
      "Security",
      "Maintenance",
      "Accounts",
      "Management",
    ]) {
      assert.ok(positionsForDepartment(department).length > 0, department);
      const lead = positionsForDepartment(department).find(
        (p) => p.modules === "full" || p.accessLevel === "owner",
      );
      assert.ok(lead, department);
    }
  });

  it("leaves a waiter on F&B role defaults", () => {
    const waiter = findStaffPosition("F&B", "Waiter");
    assert.ok(waiter);
    assert.equal(positionDeskAssignment(waiter).deskModuleKeys, null);
    assert.equal(positionDeskAssignment(waiter).deskRole, "fnb");
  });
});
