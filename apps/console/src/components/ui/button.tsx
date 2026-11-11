import {cva, type VariantProps} from 'class-variance-authority';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import type {ButtonHTMLAttributes} from 'react';
const buttonVariants=cva('btn',{variants:{variant:{default:'btn-primary',outline:'btn-outline'}},defaultVariants:{variant:'default'}});
export function Button({className,variant,...props}:ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof buttonVariants>){return <button className={twMerge(clsx(buttonVariants({variant}),className))} {...props}/>;}
