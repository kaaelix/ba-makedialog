export type PlannedScenarioIntent = {
  characterName: string;
  affiliation?: string;
  dialogue: string;
  sceneDescription: string;
  mood?: string;
  isAnimation?: boolean;
};

export class ScenarioPlannerAgent {
  /**
   * Translates natural language into a structured scenario intent.
   */
  plan(prompt: string): PlannedScenarioIntent {
    const text = prompt.trim();

    // Check for animation keywords
    const isAnimation =
      /animat(e|ed|ion)|gif|bergerak|moving|typewriter/i.test(text);

    // Extract character name heuristically or via known students
    let characterName = "Hoshino";
    let affiliation = "Abydos High School";
    let sceneDescription = "Classroom (Sunset)";
    let dialogue = "Sensei, are you still awake? Working this late isn't good for your health, you know~";

    const commonStudents = [
      { name: "Hoshino", school: "Abydos High School" },
      { name: "Shiroko", school: "Abydos High School" },
      { name: "Serika", school: "Abydos High School" },
      { name: "Nonomi", school: "Abydos High School" },
      { name: "Ayane", school: "Abydos High School" },
      { name: "Aru", school: "Gehenna Academy" },
      { name: "Mutsuki", school: "Gehenna Academy" },
      { name: "Kayoko", school: "Gehenna Academy" },
      { name: "Haruka", school: "Gehenna Academy" },
      { name: "Hina", school: "Gehenna Academy" },
      { name: "Iori", school: "Gehenna Academy" },
      { name: "Yuuka", school: "Millennium Science School" },
      { name: "Noa", school: "Millennium Science School" },
      { name: "Koyuki", school: "Millennium Science School" },
      { name: "Rio", school: "Millennium Science School" },
      { name: "Mika", school: "Trinity General School" },
      { name: "Nagisa", school: "Trinity General School" },
      { name: "Azusa", school: "Trinity General School" },
      { name: "Hifumi", school: "Trinity General School" },
      { name: "Hanako", school: "Trinity General School" },
      { name: "Koharu", school: "Trinity General School" },
      { name: "Arona", school: "General Student Council" },
      { name: "Plana", school: "General Student Council" },
    ];

    for (const stu of commonStudents) {
      const reg = new RegExp(`\\b${stu.name}\\b`, "i");
      if (reg.test(text)) {
        characterName = stu.name;
        affiliation = stu.school;
        break;
      }
    }

    // Detect location
    if (/office|kantor|ruang kerja/i.test(text)) {
      sceneDescription = /night|malam/i.test(text) ? "Schale Office (Night)" : "Schale Office (Day)";
    } else if (/desert|gurun/i.test(text)) {
      sceneDescription = "Abydos Desert";
    } else if (/beach|pantai/i.test(text)) {
      sceneDescription = "Tropical Beach (Day)";
    } else if (/city|street|jalan/i.test(text)) {
      sceneDescription = "Kivotos City Street (Night)";
    } else if (/cathedral|gereja/i.test(text)) {
      sceneDescription = "Trinity Cathedral";
    } else if (/night|malam/i.test(text)) {
      sceneDescription = "Classroom (Night)";
    } else if (/sunset|senja|sore/i.test(text)) {
      sceneDescription = "Classroom (Sunset)";
    }

    // Extract dialogue if enclosed in quotes, or build dialogue
    const quoteMatch = text.match(/["“']([^"”']+)["”']/);
    if (quoteMatch && quoteMatch[1]) {
      dialogue = quoteMatch[1];
    } else {
      // Clean up prompt to form dialogue if it looks like conversation
      dialogue = text
        .replace(/buatkan|bikin|generate|scenario|gambar|please|create/gi, "")
        .trim();
      if (!dialogue || dialogue.length < 5) {
        dialogue = `Sensei, thank you for visiting ${characterName} today!`;
      }
    }

    return {
      characterName,
      affiliation,
      dialogue,
      sceneDescription,
      isAnimation,
    };
  }
}

export const scenarioPlanner = new ScenarioPlannerAgent();
