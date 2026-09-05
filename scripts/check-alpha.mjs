import sharp from 'sharp';
const {data,info}=await sharp('public/stickers/kotaro.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
let a0=0,a255=0,amid=0;
for(let i=3;i<data.length;i+=4){const a=data[i]; if(a===0)a0++; else if(a===255)a255++; else amid++;}
console.log({a0,a255,amid,total:info.width*info.height});
