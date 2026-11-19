import {Buffer} from 'node:buffer';

export async function verifyEmulatorToken(token, signal, transport=fetch, now=Date.now()) {
  const [header,payload,signature,...extra]=token.split('.');
  if(!header||!payload||signature!==''||extra.length)throw Error('INVALID_TOKEN');
  const parse=part=>JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
  const h=parse(header),c=parse(payload),seconds=Math.floor(now/1000);
  if(h.alg!=='none'||c.aud!=='demo-raytech-v340'||c.iss!=='https://securetoken.google.com/demo-raytech-v340'||
     typeof c.sub!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(c.sub)||c.user_id!==c.sub||
     !Number.isInteger(c.exp)||c.exp<=seconds||!Number.isInteger(c.iat)||c.iat>seconds||
     !Number.isInteger(c.auth_time)||c.auth_time>c.iat)throw Error('INVALID_TOKEN');
  const r=await transport('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-only',{
    method:'POST',redirect:'manual',signal,headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token}),
  });
  if(!r.ok)throw Error('INVALID_SESSION');
  const {users}=await r.json(),user=users?.[0];
  if(users?.length!==1||user?.localId!==c.sub||user.disabled||c.auth_time<Number(user.validSince??0))throw Error('INVALID_SESSION');
  return {uid:c.sub};
}
