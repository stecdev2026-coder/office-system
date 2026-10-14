import type { NextConfig } from "next";
import {PHASE_DEVELOPMENT_SERVER} from 'next/constants';
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {'/api/admin/employees/template':['./assets/employee-template-base.xlsx']},
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
    ] }];
  },
};
export default (phase:string):NextConfig=>({...nextConfig,distDir:phase===PHASE_DEVELOPMENT_SERVER?'.next-dev':'.next'});
