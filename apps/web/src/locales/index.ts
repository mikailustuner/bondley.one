import { tr } from "./tr";

export const dictionaries = {
    tr,
};

export const getDictionary = (lang: keyof typeof dictionaries = "tr") => {
    return dictionaries[lang];
};

export type { Dictionary } from "./tr";
