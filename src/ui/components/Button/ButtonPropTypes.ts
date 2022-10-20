import { MouseEventHandler } from "react"
export interface ButtonPropTypes {
	label: string
	size?: "lg" | "md" | "sm"
	btnType?: "primary" | "secondary" | "ghost"
	shape?: "default" | "rounded" | "pill"
	onClick?: MouseEventHandler<HTMLButtonElement>
	className?: string
	styles?: object
	type?: "button" | "submit" | "reset"
	isDarkMode?: boolean
}
