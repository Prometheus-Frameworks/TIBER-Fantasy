import { computeDynastyMultiplierV2 } from "../injuryProfiles";

describe("Dynasty Injury Profiles v2", () => {
test("ACL RB 28yo year_of_injury penalized strongly", () => {
  const k = computeDynastyMultiplierV2({
    injuryType: "ACL tear", pos: "RB", age: 28, phase: "year_of_injury"
  });
  expect(k).toBeLessThan(0.7); // around ~0.61 with your example
});

test("Hamstring WR 22yo mild penalty", () => {
  const k = computeDynastyMultiplierV2({
    injuryType: "Hamstring Grade II/III", pos: "WR", age: 22, phase: "year_of_injury"
  });
  expect(k).toBeGreaterThan(0.8);
  expect(k).toBeLessThan(1.0);
});

test("High ankle RB 25yo improves as weeksRecovered grows", () => {
  const k0 = computeDynastyMultiplierV2({
    injuryType: "High ankle sprain", pos: "RB", age: 25, phase: "year_of_injury", weeksRecovered: 0
  });
  const k6 = computeDynastyMultiplierV2({
    injuryType: "High ankle sprain", pos: "RB", age: 25, phase: "year_of_injury", weeksRecovered: 6
  });
  expect(k6).toBeGreaterThan(k0);
});

test("Year after return has better multipliers than year of injury", () => {
  const kInjury = computeDynastyMultiplierV2({
    injuryType: "ACL tear", pos: "WR", age: 25, phase: "year_of_injury"
  });
  const kReturn = computeDynastyMultiplierV2({
    injuryType: "ACL tear", pos: "WR", age: 25, phase: "year_after_return"
  });
  expect(kReturn).toBeGreaterThan(kInjury);
});

test("Age penalty applies correctly for older players", () => {
  const kYoung = computeDynastyMultiplierV2({
    injuryType: "ACL tear", pos: "RB", age: 24, phase: "year_of_injury"
  });
  const kOld = computeDynastyMultiplierV2({
    injuryType: "ACL tear", pos: "RB", age: 30, phase: "year_of_injury"
  });
  expect(kOld).toBeLessThan(kYoung);
});

});