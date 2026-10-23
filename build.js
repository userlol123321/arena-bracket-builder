import { mkdir, copyFile, rm } from 'node:fs/promises';
const files = ['index.html','app.js','engine.js','teams.js','backup.js','local-streams.js','viewer.html','viewer.js','viewer.css','bracket-view.js','themes.js','themes.css','style.css','SETUP.md'];
await rm(new URL('./dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
for (const file of files) await copyFile(new URL(file,import.meta.url),new URL(`dist/${file}`,import.meta.url));
await copyFile(new URL('node_modules/exceljs/dist/exceljs.min.js',import.meta.url),new URL('dist/exceljs.min.js',import.meta.url));
console.log('Static site built in dist/. Ready for GitHub Pages.');
