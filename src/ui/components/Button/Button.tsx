import React, {type FC } from "react"
import { ButtonPropTypes } from "./ButtonPropTypes"

import "./Button.css"

/**
 * A Button that takes label text as a mandatory prop
 * and returns a React Button component.
 *
 * @param {string} label - text to be displayed inside the button
 * @param {string} size - `"lg" | "md" | "sm"`
 * @param {string} type - normal html button types - `"button" | "submit" | "reset"`
 * @param {string} btnType - `"primary" | "secondary" | "ghost"`
 * @param {string} className - additional class to be applied
 * @func onClick - function of MouseEventHandler type, returns void
 * @param {string} shape - - "default" | "rounded" | "pill"
 * @param {object} styles - inline styles to be applied
 * @param {boolean} isDarkMode - default `false`
 * @returns Button
 */
const Button: FC<ButtonPropTypes> = (props) => {
	const {
		label,
		size = "md",
		type = "button",
		btnType = "primary",
		className,
		onClick,
		shape = "default",
		styles,
		isDarkMode = false,
	} = props
	return (
		<button
			type={type}
			className={`button ${size} ${btnType} ${shape} ${
				isDarkMode === true && `dark`
			} ${className}`}
			style={styles}
			onClick={onClick}>
			{label}
		</button>
	)
}

export default Button
