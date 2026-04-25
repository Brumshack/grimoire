// SRD 5.1 has only Acolyte in the OGL SRD. We also include Haunted One
// (Curse of Strahd Player's Guide / Van Richten's Guide) because the user's
// home campaigns rely on it; it is non-SRD content kept in this file rather
// than as a custom feature so it slots cleanly into the Background dropdown
// and contributes its skill/language proficiencies to derive.

export const BACKGROUNDS = {
  "haunted-one": {
    id: "haunted-one", name: "Haunted One",
    skills: ["arcana","investigation"],   // 2 of: Arcana, Investigation, Religion, Survival
    tools: [],
    languages: 1,    // one exotic of choice
    equipment: [
      "A monster hunter's pack",
      "Trinket of haunted past",
      "Set of common clothes",
      "A belt pouch containing 1 gp"
    ],
    feature: {
      name: "Heart of Darkness",
      desc: "Those who look into your eyes can see that you have faced unimaginable horror and that you are no stranger to darkness. Common folk extend you every courtesy and do their utmost to help you, even taking up arms to fight alongside you. They will not, however, willingly endanger themselves."
    },
    suggestedTraits: {
      personality: [
        "I don't run from evil — evil runs from me.",
        "I like to talk at length about my profession.",
        "Don't expect me to save those who can't save themselves. It is nature's way that the strong survive.",
        "I'm always polite and respectful, even to my enemies."
      ],
      ideals: [
        "Greater Good — my purpose is to free the world from the curse that haunts me.",
        "Pragmatism — survival comes before honor; whatever it takes.",
        "Knowledge — to defeat the darkness, you must understand it.",
        "Vengeance — those responsible for my torment will pay."
      ],
      bonds: [
        "I keep a memento of the horror that broke me, as a reminder of what awaits if I fail.",
        "An innocent in my charge is the only thing standing between me and despair.",
        "I will destroy the one who broke me, no matter how long it takes.",
        "Someone I trusted betrayed me; I will never trust easily again."
      ],
      flaws: [
        "I have nightmares so vivid that I dread sleep.",
        "I am tortured by memories of my horrible past, and the smallest reminder can trigger them.",
        "My contact with the otherworldly has changed me; I sometimes hear whispers no one else hears.",
        "I assume that the worst of any person is true, and trust must be earned."
      ]
    }
  },
  acolyte: {
    id: "acolyte", name: "Acolyte",
    skills: ["insight","religion"],
    tools: [],
    languages: 2,  // two of choice
    equipment: [
      "A holy symbol",
      "A prayer book or prayer wheel",
      "Five sticks of incense",
      "Vestments",
      "A set of common clothes",
      "A belt pouch containing 15 gp"
    ],
    feature: {
      name: "Shelter of the Faithful",
      desc: "As an acolyte, you command the respect of those who share your faith, and can perform religious ceremonies. You and your adventuring companions can expect to receive free healing and care at a temple, shrine, or other established presence of your faith."
    },
    suggestedTraits: {
      personality: [
        "I idolize a particular hero of my faith, and constantly refer to that person's deeds.",
        "I can find common ground between the fiercest enemies, empathizing with them.",
        "I see omens in every event and action; the gods try to speak to us.",
        "Nothing can shake my optimistic attitude."
      ],
      ideals: [
        "Tradition — the ancient traditions must be preserved.",
        "Charity — I always try to help those in need.",
        "Change — we must help bring about the changes the gods are constantly working in the world.",
        "Faith — I trust that my deity will guide my actions."
      ],
      bonds: [
        "I would die to recover an ancient relic of my faith.",
        "I will someday get revenge on the corrupt temple hierarchy.",
        "I owe my life to the priest who took me in when my parents died.",
        "Everything I do is for the common people."
      ],
      flaws: [
        "I judge others harshly, and myself even more severely.",
        "I put too much trust in those who wield power within my temple's hierarchy.",
        "My piety sometimes leads me to blindly trust those that profess faith in my god.",
        "I am inflexible in my thinking."
      ]
    }
  }
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);
