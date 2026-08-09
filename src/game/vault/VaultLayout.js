export function getVaultLayout(room) {
    const centerX = room.x + room.width / 2;
    const centerY = room.y + room.height / 2;
    const contractOffset = Math.min(270, room.width * 0.18);
    const pylonOffsetX = Math.min(430, room.width * 0.28);
    const pylonOffsetY = Math.min(360, room.height * 0.24);

    return {
        center: { x: centerX, y: centerY },
        contracts: {
            gilded: { x: centerX - contractOffset, y: centerY + 120 },
            blood: { x: centerX + contractOffset, y: centerY + 120 }
        },
        pylons: [
            { x: centerX - pylonOffsetX, y: centerY - pylonOffsetY },
            { x: centerX + pylonOffsetX, y: centerY - pylonOffsetY },
            { x: centerX + pylonOffsetX, y: centerY + pylonOffsetY },
            { x: centerX - pylonOffsetX, y: centerY + pylonOffsetY }
        ],
        gates: [
            { x: centerX, y: room.y + 170 },
            { x: room.x + room.width - 170, y: centerY },
            { x: centerX, y: room.y + room.height - 170 },
            { x: room.x + 170, y: centerY }
        ]
    };
}
