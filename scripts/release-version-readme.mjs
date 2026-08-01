/**
 * @param {string} readme
 * @param {string} releaseVersion
 */
export function hasReleaseVersionBadge(readme, releaseVersion) {
    const badgeVersion = releaseVersion.replaceAll('-', '--');
    return readme.includes(
        `https://img.shields.io/badge/version-${badgeVersion}-`
    );
}

/** @param {string} readme */
export function hasSupportedNodeRequirement(readme) {
    return /node(?:\.js)?\s+22\.12(?:\+|\s+or\s+newer)/i.test(readme);
}
