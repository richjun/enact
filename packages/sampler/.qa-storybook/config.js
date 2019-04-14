import {addParameters} from '@storybook/react';
import {create} from '@storybook/theming';
import configure from '../src/configure';

const stories = require.context('../stories/qa', true, /.js$/);

addParameters({
	options: {
		theme: create({
			base: 'light',
			brandTitle: 'ENACT QA SAMPLER',
			brandUrl: 'http://enactjs.com/'
			// To control appearance:
			// brandImage: 'http://url.of/some.svg',
		}),
		isFullscreen: false,
		showNav: true,
		showPanel: true,
		panelPosition: 'left'
	}
});

configure(stories, module);
