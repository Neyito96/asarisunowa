/** Request-level evidence without tokens, raw body, Authorization or OAuth changes. */
export function spotifyFailureEvidence({httpStatus,method='GET',path='',oauthGrant='UNKNOWN',grantedScopes=null,requiredScope=null,ownerOrCollaborator=null,retryAfter=null,at=new Date().toISOString()}={}){
 const endpoint=String(path).split('?')[0];
 const safeEndpoint=/^\/(?:me(?:\/playlists)?|episodes\/[A-Za-z0-9]{22}|playlists\/[A-Za-z0-9]{22}(?:\/(?:items|tracks))?)$/.test(endpoint)?endpoint:'UNCLASSIFIED_ENDPOINT';
 const reasons=[];
 if(httpStatus===403){if(/\/tracks$/.test(endpoint))reasons.push('LEGACY_ENDPOINT_REQUIRES_MIGRATION');if(oauthGrant==='client_credentials'&&/playlists/.test(endpoint))reasons.push('USER_AUTH_REQUIRED_FOR_PLAYLIST_OPERATION');if(Array.isArray(grantedScopes)&&requiredScope&&!grantedScopes.includes(requiredScope))reasons.push('REQUIRED_SCOPE_MISSING');if(ownerOrCollaborator===false)reasons.push('NOT_OWNER_OR_COLLABORATOR');}
 return {httpStatus,method:['GET','POST'].includes(method)?method:'OTHER',endpoint:safeEndpoint,at,
  status:httpStatus===401?'AUTH_REQUIRED':httpStatus===403?'FORBIDDEN':httpStatus===429?'RATE_LIMITED':httpStatus>=500?'SERVICE_FAILURE':'HTTP_ERROR',
  observedReasons:reasons,rootCause:reasons.length?'REQUEST_CONFIGURATION_EVIDENCE':'UNCONFIRMED',retryAfter:httpStatus===429?String(retryAfter??''):null,
  writesSuccessful:0};
}
