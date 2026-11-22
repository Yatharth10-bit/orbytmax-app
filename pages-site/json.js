export function jsonOk(data, init) { return Response.json(data, init); }
export function jsonError(error, status=400) { return Response.json({error},{status}); }
