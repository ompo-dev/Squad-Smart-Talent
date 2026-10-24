import {mkdir,copyFile} from "node:fs/promises"
await mkdir("public/swagger",{recursive:true})
for(const name of ["swagger-ui.css","swagger-ui-bundle.js"])await copyFile(`node_modules/swagger-ui-dist/${name}`,`public/swagger/${name}`)
