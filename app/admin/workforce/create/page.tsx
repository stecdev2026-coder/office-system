import WorkforceLocationEditor from '@/components/WorkforceLocationEditor';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return <WorkforceLocationEditor locationId={id}/>;}
