export class BodyTooLarge extends Error {}
export async function boundedBody(request:Request,maximum:number){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array()
 const chunks:Uint8Array[]=[];let size=0
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){void reader.cancel().catch(()=>{});throw new BodyTooLarge("Corpo acima do limite")}chunks.push(value)}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}return result
}
