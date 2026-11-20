// 빌드가 끝나면 목소리 파일(audio/manifest.json, audio/files)을 배포 폴더에도 복사한다.
// 앱은 jsDelivr CDN을 먼저 쓰고, CDN이 안 될 때만 이 복사본을 쓴다.
import { cpSync, existsSync, mkdirSync } from "node:fs";

mkdirSync("dist/audio", { recursive: true });
cpSync("audio/manifest.json", "dist/audio/manifest.json");
if (existsSync("audio/files")) cpSync("audio/files", "dist/audio/files", { recursive: true });
console.log("목소리 파일을 dist/audio 로 복사했어요");
