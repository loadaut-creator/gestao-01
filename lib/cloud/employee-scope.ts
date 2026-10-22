import type { ImportRecord } from "../bi/model";
import { findEmployeeForSeller } from "../bi/model";
import type { Employee } from "../team/model";
export function scopeEmployeeImports(imports:ImportRecord[],employeeId:string,employees:Employee[]):ImportRecord[] {
 const employee=employees.find(item=>item.id===employeeId&&item.status==="ativo");
 if(!employee)return [];
 return imports.flatMap(record=>{
  const records=record.records.filter(row=>findEmployeeForSeller(row.seller,employees)?.id===employeeId);
  if(!records.length)return [];
  // Do not expose global totals, row counts or seller-role dictionaries.
  const {sellerRoles:ignored,...metadata}=record;void ignored;
  return [{...metadata,records,rowCount:records.length,totalSale:records.reduce((total,row)=>total+row.sale,0)}];
 });
}
