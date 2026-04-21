// SRD 5.1: only Acolyte is in the OGL SRD. Others can be added as homebrew.

export const BACKGROUNDS = {
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
