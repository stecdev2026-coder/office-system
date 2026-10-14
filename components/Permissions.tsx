"use client";
import {createContext,useContext} from 'react';
import {hasPermission} from '@/lib/permissions/catalog';
export const PermissionsContext=createContext<{permissions:string[];isSuperAdmin:boolean}>({permissions:[],isSuperAdmin:false});
export function usePermissions(){const value=useContext(PermissionsContext);return {...value,can:(key:string)=>hasPermission(value.permissions,key)};}
export function Can({permission,children}:{permission:string;children:React.ReactNode}){const {can}=usePermissions();return can(permission)?children:null;}
