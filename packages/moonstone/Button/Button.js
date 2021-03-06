/**
 * Moonstone styled button components and behaviors.
 *
 * @example
 * <Button small>Hello Enact!</Button>
 *
 * @module moonstone/Button
 * @exports Button
 * @exports ButtonBase
 * @exports ButtonDecorator
 */

import kind from '@enact/core/kind';
import Uppercase from '@enact/i18n/Uppercase';
import Spottable from '@enact/spotlight/Spottable';
import {ButtonBase as UiButtonBase, ButtonDecorator as UiButtonDecorator} from '@enact/ui/Button';
import Pure from '@enact/ui/internal/Pure';
import PropTypes from 'prop-types';
import compose from 'ramda/src/compose';

import {IconBase} from '../Icon';
import {MarqueeDecorator} from '../Marquee';
import Skinnable from '../Skinnable';

import componentCss from './Button.module.less';

// Make a basic Icon in case we need it later. This cuts `Pure` out of icon for a small gain.
const Icon = Skinnable(IconBase);

/**
 * A button component.
 *
 * This component is most often not used directly but may be composed within another component as it
 * is within [Button]{@link moonstone/Button.Button}.
 *
 * @class ButtonBase
 * @memberof moonstone/Button
 * @extends ui/Button.ButtonBase
 * @ui
 * @public
 */
const ButtonBase = kind({
	name: 'Button',

	propTypes: /** @lends moonstone/Button.ButtonBase.prototype */ {
		/**
		 * The background opacity of this button.
		 *
		 * Valid values are:
		 * * `'translucent'`,
		 * * `'lightTranslucent'`, and
		 * * `'transparent'`.
		 *
		 * @type {String}
		 * @public
		 */
		backgroundOpacity: PropTypes.oneOf(['translucent', 'lightTranslucent', 'transparent']),

		/**
		 * The color of the underline beneath button's content.
		 *
		 * Accepts one of the following color names, which correspond with the colored buttons on a
		 * standard remote control: `'red'`, `'green'`, `'yellow'`, `'blue'`.
		 *
		 * @type {String}
		 * @public
		 */
		color: PropTypes.oneOf(['red', 'green', 'yellow', 'blue']),

		/**
		 * Customizes the component by mapping the supplied collection of CSS class names to the
		 * corresponding internal Elements and states of this component.
		 *
		 * The following classes are supported:
		 *
		 * * `button` - The root class name
		 * * `bg` - The background node of the button
		 * * `selected` - Applied to a `selected` button
		 * * `small` - Applied to a `small` button
		 *
		 * @type {Object}
		 * @public
		 */
		css: PropTypes.object
	},

	styles: {
		css: componentCss,
		publicClassNames: ['button', 'bg', 'selected', 'small']
	},

	computed: {
		className: ({backgroundOpacity, color, styler}) => styler.append(
			backgroundOpacity,
			color
		)
	},

	render: ({css, ...rest}) => {
		delete rest.backgroundOpacity;
		delete rest.color;

		return UiButtonBase.inline({
			'data-webos-voice-intent': 'Select',
			...rest,
			css,
			iconComponent: Icon
		});
	}
});

/**
 * Enforces a minimum width on the Button.
 *
 * *NOTE*: This property's default is `true` and must be explicitly set to `false` to allow
 * the button to shrink to fit its contents.
 *
 * @name minWidth
 * @memberof moonstone/Button.ButtonBase.prototype
 * @type {Boolean}
 * @default true
 * @public
 */


/**
 * Applies Moonstone specific behaviors to [Button]{@link moonstone/Button.ButtonBase} components.
 *
 * @hoc
 * @memberof moonstone/Button
 * @mixes i18n/Uppercase.Uppercase
 * @mixes moonstone/Marquee.MarqueeDecorator
 * @mixes ui/Button.ButtonDecorator
 * @mixes spotlight/Spottable.Spottable
 * @mixes moonstone/Skinnable.Skinnable
 * @public
 */
const ButtonDecorator = compose(
	Pure,
	Uppercase,
	MarqueeDecorator({className: componentCss.marquee}),
	UiButtonDecorator,
	Spottable,
	Skinnable
);

/**
 * A button component, ready to use in Moonstone applications.
 *
 * Usage:
 * ```
 * <Button
 * 	backgroundOpacity="translucent"
 * 	color="blue"
 * >
 * 	Press me!
 * </Button>
 * ```
 *
 * @class Button
 * @memberof moonstone/Button
 * @extends moonstone/Button.ButtonBase
 * @mixes moonstone/Button.ButtonDecorator
 * @ui
 * @public
 */
const Button = ButtonDecorator(ButtonBase);

export default Button;
export {
	Button,
	ButtonBase,
	ButtonDecorator
};
