module.exports = {
  packagerConfig: {
    name: 'Our Stage',
    executableName: 'our-stage',
    asar: true,
    ignore: [
      /^\/docs/,
      /^\/tests/,
      /^\/packages/,
      /^\/scripts/,
      /^\/apps\/editor\/src/,
      /^\/apps\/desktop\/src/,
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'our_stage',
        authors: 'Our Stage',
        description: 'Local-first AI-assisted MMD character director playground.',
      },
    },
  ],
};
