import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

type ButtonVariant = 'primary' | 'secondary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const classes = ['btn', variant === 'secondary' ? 'btn-secondary' : 'btn-primary', className]
    .filter(Boolean)
    .join(' ')

  return <button className={classes} {...rest} />
}

export default Button
