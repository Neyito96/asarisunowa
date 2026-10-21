"""Authenticated READ_ONLY adapter. Use existing approved Google ADC/WIF credentials.
Never downloads OAuth tokens to artifacts, never writes Sheets, never runs V3.
Requires google-auth + requests. Run with PRIVATE_OUTPUT.json outside repository.
"""
import datetime, hashlib, json, sys
from pathlib import Path

SHEET_ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'
def read_source(session):
    base='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID
    def get(url,params=None):
        response=session.get(url,params=params,timeout=45)
        if response.status_code!=200:
            raise RuntimeError('Sheets read failed HTTP '+str(response.status_code))
        return response.json()
    metadata=get(base,{'fields':'properties(timeZone),sheets(properties(title,gridProperties(rowCount,columnCount)))'})
    if metadata['properties']['timeZone']!='Asia/Tokyo':raise RuntimeError('Unexpected ledger timezone')
    tabs={s['properties']['title']:s['properties']['gridProperties'] for s in metadata['sheets']}
    def tab(name,width):
        grid=tabs[name]
        if grid['rowCount']>100000 or grid['columnCount']<width:raise RuntimeError('Unexpected grid size')
        rows=[]
        for start in range(1,grid['rowCount']+1,500):
            end=min(grid['rowCount'],start+499)
            block=get(base+'/values/'+"'"+name+"'!A"+str(start)+':'+{55:'BC',3:'C',2:'B'}[width]+str(end),{'valueRenderOption':'UNFORMATTED_VALUE','dateTimeRenderOption':'SERIAL_NUMBER'}).get('values',[])
            rows.extend([r+['']*max(0,width-len(r)) for r in block])
        return rows
    ledger=tab('エピソード台帳',55);exclusions=tab('削除・除外履歴',2)
    states=tab('図書館V3・項目状態',3)
    if states[0][:3]!=['EP-ID','fieldStatesJSON','updatedAt']:raise RuntimeError('Unexpected V3 state headers')
    for row in ledger[1:]:
        if isinstance(row[3],(int,float)):
            row[3]=(datetime.datetime(1899,12,30)+datetime.timedelta(seconds=round(row[3]*86400))).strftime('%Y-%m-%d %H:%M:%S')
    return {'headers':ledger[0],'rows':[r for r in ledger[1:] if r[0]],'exclusions':exclusions,'v3FieldStates':[r for r in states[1:] if r[0]],'snapshotDate':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()}

def stable_source(session):
    first=read_source(session);second=read_source(session)
    if first!=second:raise RuntimeError('Live ledger changed during read; retry later')
    return second

def main():
    import google.auth
    from google.auth.transport.requests import AuthorizedSession
    output=Path(sys.argv[1]).resolve();repo=Path(__file__).resolve().parents[1]
    if output.is_relative_to(repo):raise RuntimeError('Private source must stay outside repository')
    credentials,_=google.auth.default(scopes=['https://www.googleapis.com/auth/spreadsheets.readonly'])
    session=AuthorizedSession(credentials)
    second=stable_source(session)
    output.write_text(json.dumps(second,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'stage':'ledger_read','status':'SUCCESS','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rowsObserved':len(second['rows']),'googleWrites':0}))
if __name__=='__main__':main()
