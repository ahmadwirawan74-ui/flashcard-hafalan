import { DraftKind } from "./parser";

export const TEMPLATES: { kind: DraftKind; label: string; icon: string }[] = [
	{ kind: "single", label: "Single Line", icon: "copy" },
	{ kind: "multi", label: "Multi Line", icon: "align-left" },
	{ kind: "list", label: "List", icon: "list-ordered" },
	{ kind: "mcq", label: "Multiple Choice", icon: "list-checks" },
	{ kind: "cloze", label: "Cloze", icon: "brackets" },
	{ kind: "occlusion", label: "Image Occlusion", icon: "image" },
];
