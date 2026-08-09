export function partSoundEventKey(partId, slot = 'fire') {
    return `part:${partId}:${slot}`;
}

export function globalSoundEventKey(eventId) {
    return `global:${eventId}`;
}
