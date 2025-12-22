
import { calculateTotalProjectDistance, Point, ExtraConnection } from '../calculations';
import { describe, it, expect } from 'vitest'; // Using vitest syntax, but I'll run it with a simple node script if needed

// Mock helper
const createPoint = (id: number, lat: number, lng: number, connectedFrom: number | null = null, spans: number = 1): Point => ({
  id, lat, lng, connectedFrom, spans
});

// Simple test runner since I might not have vitest configured in package.json
// I'll execute this via node by compiling it or just trusting the logic for now,
// but actually I will create a simple JS test script to run in the shell.

console.log("Running Calculation Tests...");

// Test Case 1: Simple Line (3 points, 100m each approx)
// 1 deg lat is approx 111km. 0.001 is 111m.
const p1 = createPoint(1, 0, 0);
const p2 = createPoint(2, 0.001, 0, 1); // connected to 1
const p3 = createPoint(3, 0.002, 0, 2); // connected to 2

const dist = calculateTotalProjectDistance([p1, p2, p3]);
console.log(`Test 1 (Simple Line): ${dist > 220 && dist < 224 ? 'PASS' : 'FAIL'} (${dist})`);

// Test Case 2: Spans (Vãos)
// p2 has 3 spans. Distance p1->p2 is ~111m. Total should be 111 * 3 + 111 = 444m
const p2_spans = createPoint(2, 0.001, 0, 1, 3);
const distSpans = calculateTotalProjectDistance([p1, p2_spans, p3]);
console.log(`Test 2 (Spans): ${distSpans > 440 && distSpans < 450 ? 'PASS' : 'FAIL'} (${distSpans})`);

// Test Case 3: Branching
// p4 connects to p2.
const p4 = createPoint(4, 0.001, 0.001, 2);
// p1->p2 (111m), p2->p3 (111m), p2->p4 (111m). Total ~333m.
const distBranch = calculateTotalProjectDistance([p1, p2, p3, p4]);
console.log(`Test 3 (Branching): ${distBranch > 330 && distBranch < 340 ? 'PASS' : 'FAIL'} (${distBranch})`);
