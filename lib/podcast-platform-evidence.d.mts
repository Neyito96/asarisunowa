export const platformOrder: readonly string[];
export function publicUrl(value: unknown): string;
export function classifyPlatformUrl(value: unknown): {provider: string;level:string;url:string;id?:string};
export function providerLabel(value: unknown): string;
export function orderPlatformLinks<T extends {label:string}>(links:T[]):T[];
export function matchAppleProgramme(anchor:{rss?:string;url?:string},items:Record<string,unknown>[]):{state:string;reason:string;item?:Record<string,unknown>};
export function confirmedProgrammeLinks(values:string[]):{links:Record<string,string>;held:unknown[]};
export function matchEpisode(anchor:Record<string,unknown>, candidates:Record<string,unknown>[]):{state:string;reason?:string;item?:Record<string,unknown>};
