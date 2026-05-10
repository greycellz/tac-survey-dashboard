import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ResearcherNotesEntry } from "../../../src/types/qualitative";
import { loadResearcherNotes } from "../load-notes";

const FIXTURE = `Participant,Transcripts ,Life and routine changes and challenges,Emotional impact,Recovery challenges and pain points,Needs over time,Technology for recovery,AI for Recovery Attitudes and Beliefs,ChatGPT insights,,What is your age?,What is your gender?,Do you have children under the age of 18?,Are you a caregiver for a relative with a disability or health condition?,Are you currently caring for a pet?,How would you describe your current living situation?,Which fire(s) affected you most directly?,How were you impacted by the fire? (check all that apply),How long were you displaced from your home (if applicable)?,What stage of recovery are you currently in?,"Since the fire, which areas have been most challenging for you? (Select up to 3)","When you think about your recovery process so far, what has felt most overwhelming?",Who or what has been most helpful in your recovery process?,What would have made your recovery process easier?,How would you describe your emotional wellbeing right now?,Have you sought any emotional or mental health support since the fire?,What barriers make it hard to get emotional or mental health support? (check all that apply),How do you currently cope with stress or difficult emotions?,Which types of help do you most need right now? (Select all that apply),Have you ever used an AI tool or chatbot before?,How interested would you be in using an AI chatbot as part of your fire recovery process?,"If an AI coach could help you with one thing in your fire recovery right now, what would it be?",Is there anything else you'd like to share about your experience or ideas for how to reduce stress in the recovery process and empower survivors?,What advice would you give to someone who just experienced a disaster?
1,https://example.com/p1,Routines collapsed.,Grief was specific.,Permitting was hard.,Long timeline.,Spreadsheets.,Plain-language summaries.,Procedural scaffolding helps.,,59,Male,No,No,Yes,Temporary housing,Eaton Fire,Home completely destroyed,Still displaced,Actively rebuilding,Emotional or mental health stress; Finding clear information and resources,Loss of heirlooms,Insurance helped,Nothing,Good,"Yes, from a peer network",Lack of time; Not sure it would help,Weekly meetings,Information about recovery,Yes,Somewhat interested,Building advice,Forms help would have been useful,Go to the DRC right away.
2,https://example.com/p2,Activism took over.,Displaced into action.,Standing-home contamination.,Slowing down.,Community data systems.,n/a,Some survivors become infrastructure.,,52,Female,Yes,Yes,No,Temporary housing,Eaton Fire,Smoke damage only; Lost a pet; Health issues from stress,Still displaced,Still trying to meet basic needs,"Managing insurance and rebuilding paperwork; Emotional or mental health stress; Helping children or family cope; Other: contamination",Navigating contamination,Community on Discord,Standards for indoor contamination,Fair,No,Cost; Stigma,Activism,Help with paperwork,No,Very interested,Help understanding insurance,Lots more to share,Get a notebook.
,blank-id-row-should-be-skipped,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
17,https://example.com/p17,Survey-only row,No transcript,,,,,,,42,Female,No,No,No,Rebuilt,Eaton Fire,Home damaged,1-6 months,Nearly recovered,Financial strain,Money,Family,More guidance,Good,No,Cost,Walking,Financial help,No,Very interested,Insurance navigation,More sharing,Stay calm.
`;

let entries: ResearcherNotesEntry[];

beforeAll(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notes-test-"));
  const fixturePath = path.join(tmpDir, "notes.csv");
  fs.writeFileSync(fixturePath, FIXTURE);
  entries = loadResearcherNotes(fixturePath);
});

describe("loadResearcherNotes", () => {
  it("returns one entry per non-blank participant row, including survey-only rows", () => {
    expect(entries.map((e) => e.id)).toEqual(["INT001", "INT002", "INT017"]);
  });

  it("skips rows with blank participant id silently", () => {
    expect(entries).toHaveLength(3);
  });

  it("parses scalar demographics", () => {
    const p1 = entries.find((e) => e.id === "INT001")!;
    expect(p1.demographics.age).toBe(59);
    expect(p1.demographics.gender).toBe("Male");
    expect(p1.demographics.hasPet).toBe(true);
    expect(p1.demographics.hasChildrenUnder18).toBe(false);
  });

  it("parses single-select categorical fields", () => {
    const p1 = entries.find((e) => e.id === "INT001")!;
    expect(p1.demographics.recoveryStage).toBe("Actively rebuilding");
    expect(p1.demographics.emotionalWellbeing).toBe("Good");
  });

  it("parses multiselect fields into clean string arrays", () => {
    const p1 = entries.find((e) => e.id === "INT001")!;
    expect(p1.demographics.challengingAreas).toEqual([
      "Emotional or mental health stress",
      "Finding clear information and resources",
    ]);
    expect(p1.demographics.mentalHealthBarriers).toEqual([
      "Lack of time",
      "Not sure it would help",
    ]);

    const p2 = entries.find((e) => e.id === "INT002")!;
    expect(p2.demographics.challengingAreas).toContain("Other: contamination");
  });

  it("preserves free-text long-form fields", () => {
    const p1 = entries.find((e) => e.id === "INT001")!;
    expect(p1.demographics.aiCoachWish).toBe("Building advice");
    expect(p1.demographics.adviceForOthers).toBe("Go to the DRC right away.");
  });

  it("normalizes 'n/a' to null in researcher notes", () => {
    const p2 = entries.find((e) => e.id === "INT002")!;
    expect(p2.notes.aiAttitudesAndBeliefs).toBeNull();
  });

  it("returns null for blank long-form cells", () => {
    const p17 = entries.find((e) => e.id === "INT017")!;
    expect(p17.notes.recoveryChallengesAndPainPoints).toBeNull();
  });
});
