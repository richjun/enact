import clamp from 'ramda/src/clamp';
import curry from 'ramda/src/curry';
import {forward} from '@enact/core/handle';
import {is} from '@enact/core/keymap';
import React from 'react';
import Spotlight, {getDirection} from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spottable from '@enact/spotlight/Spottable';

import {dataIndexAttribute} from '../Scroller/Scrollable';

const
	dataContainerDisabledAttribute = 'data-container-disabled',
	forwardKeyDown = forward('onKeyDown'),
	isDown = is('down'),
	isLeft = is('left'),
	isRight = is('right'),
	isUp = is('up');

const VirtualListSpotlightContainerConfig = {
	enterTo: 'last-focused',
	/**
	 * Returns the data-index as the key for last focused
	 */
	lastFocusedPersist: (node) => {
		const indexed = node.dataset.index ? node : node.closest('[data-index]');
		if (indexed) {
			return {
				container: false,
				element: true,
				key: indexed.dataset.index
			};
		}
	},
	/**
	 * Restores the data-index into the placeholder if its the only element. Tries to find a
	 * matching child otherwise.
	 */
	lastFocusedRestore: ({key}, all) => {
		if (all.length === 1 && 'vlPlaceholder' in all[0].dataset) {
			all[0].dataset.index = key;

			return all[0];
		}

		return all.reduce((focused, node) => {
			return focused || node.dataset.index === key && node;
		}, null);
	},
	preserveId: true,
	restrict: 'self-first'
};

const CurriedSpotlightContainerDecorator = curry(SpotlightContainerDecorator);

const VirtualListSpotlightContainerDecorator = CurriedSpotlightContainerDecorator(VirtualListSpotlightContainerConfig);

const SpotlightPlaceholder = Spottable('div');

const interfaces = [
	'setLastFocusedIndex',
	'setContainerDisabled',
	'scrollToNextItem',
	'shouldPreventScrollByFocus',
	'onKeyDown',
	'handleGlobalKeyDown'
];

/**
 * {@link moonstone/VirtualList.VirtualListSpotlightManager} is the class to manager the Spotlight in VirtualList.
 *
 * @class VirtualListSpotlightManager
 * @memberof moonstone/VirtualList
 * @private
 */
class VirtualListSpotlightManager {
	/**
	 * @constructor
	 * @memberof moonstone/VirtualList.VirtualListSpotlightManager
	 */
	constructor ({list}) {
		this.list = list;

		interfaces.forEach(func => {
			this.list[func] = this[func];
		});
	}

	isScrolledBy5way = false

	restoreLastFocused = false
	nodeIndexToBeFocused = null
	preservedIndex = null
	lastFocusedIndex = null

	/**
	 * Handle a Page up/down key with disabled items
	 */

	_findSpottableItem = (indexFrom, indexTo) => {
		const
			{data, dataSize} = this.props,
			safeIndexFrom = clamp(0, dataSize - 1, indexFrom),
			safeIndexTo = clamp(-1, dataSize, indexTo),
			delta = (indexFrom < indexTo) ? 1 : -1;

		if (indexFrom < 0 && indexTo < 0 || indexFrom >= dataSize && indexTo >= dataSize) {
			return -1;
		}

		if (safeIndexFrom !== safeIndexTo) {
			for (let i = safeIndexFrom; i !== safeIndexTo; i += delta) {
				if (data[i] && data[i].disabled === false) {
					return i;
				}
			}
		}

		return -1;
	}

	_getIndexToScrollDisabled = (direction, currentIndex) => {
		const
			{_findSpottableItem} = this,
			{data, dataSize, spacing} = this.list.props,
			{dimensionToExtent, primary} = this.list,
			{firstVisibleIndex, lastVisibleIndex} = this.list.moreInfo,
			numOfItemsInPage = (Math.floor((primary.clientSize + spacing) / primary.gridSize) * dimensionToExtent),
			isPageDown = (direction === 'down' || direction === 'right') ? 1 : -1;
		let candidateIndex = -1;

		/* First, find a spottable item in this page */
		if (isPageDown === 1) { // Page Down
			if ((lastVisibleIndex - (lastVisibleIndex % dimensionToExtent || dimensionToExtent)) >= currentIndex) {
				candidateIndex = _findSpottableItem(
					lastVisibleIndex,
					currentIndex - (currentIndex % dimensionToExtent) + dimensionToExtent - 1
				);
			}
		} else if (firstVisibleIndex + dimensionToExtent <= currentIndex) { // Page Up
			candidateIndex = _findSpottableItem(
				firstVisibleIndex,
				currentIndex - (currentIndex % dimensionToExtent)
			);
		}

		/* Second, find a spottable item in the next page */
		if (candidateIndex === -1) {
			if (isPageDown === 1) { // Page Down
				candidateIndex = _findSpottableItem(lastVisibleIndex + numOfItemsInPage, lastVisibleIndex);
			} else { // Page Up
				candidateIndex = _findSpottableItem(firstVisibleIndex - numOfItemsInPage, firstVisibleIndex);
			}
		}

		/* Last, find a spottable item in a whole data */
		if (candidateIndex === -1) {
			if (isPageDown === 1) { // Page Down
				candidateIndex = _findSpottableItem(lastVisibleIndex + numOfItemsInPage + 1, dataSize);
			} else { // Page Up
				candidateIndex = _findSpottableItem(firstVisibleIndex - numOfItemsInPage - 1, -1);
			}
		}

		/* For grid lists, find the nearest item from the current item */
		if (candidateIndex !== -1) {
			const
				currentPosInExtent = currentIndex % dimensionToExtent,
				firstIndexInExtent = candidateIndex - (candidateIndex % dimensionToExtent),
				lastIndexInExtent = clamp(firstIndexInExtent, dataSize - 1, firstIndexInExtent + dimensionToExtent);
			let
				minDistance = dimensionToExtent,
				distance,
				index;
			for (let i = firstIndexInExtent; i <= lastIndexInExtent; ++i) {
				if (data[i] && !data[i].disabled) {
					distance = Math.abs(currentPosInExtent - i % dimensionToExtent);
					if (distance < minDistance) {
						minDistance = distance;
						index = i;
					}
				}
			}

			return index;
		} else {
			return -1;
		}
	}

	_getIndexToScroll = (direction, currentIndex) => {
		const
			{dataSize, spacing} = this.list.props,
			{dimensionToExtent, primary} = this.list,
			numOfItemsInPage = Math.floor((primary.clientSize + spacing) / primary.gridSize) * dimensionToExtent,
			factor = (direction === 'down' || direction === 'right') ? 1 : -1;
		let indexToScroll = currentIndex + factor * numOfItemsInPage;

		if (indexToScroll < 0) {
			indexToScroll = currentIndex % dimensionToExtent;
		} else if (indexToScroll >= dataSize) {
			indexToScroll = dataSize - dataSize % dimensionToExtent + currentIndex % dimensionToExtent;
			if (indexToScroll >= dataSize) {
				indexToScroll = dataSize - 1;
			}
		}

		return indexToScroll === currentIndex ? -1 : indexToScroll;
	}

	scrollToNextItem = ({direction, focusedItem}) => {
		const
			{data} = this.list.props,
			focusedIndex = Number.parseInt(focusedItem.getAttribute(dataIndexAttribute)),
			{firstVisibleIndex, lastVisibleIndex} = this.list.moreInfo;
		let indexToScroll = -1;

		if (Array.isArray(data) && data.some((item) => item.disabled)) {
			indexToScroll = this._getIndexToScrollDisabled(direction, focusedIndex);
		} else {
			indexToScroll = this._getIndexToScroll(direction, focusedIndex);
		}

		if (indexToScroll !== -1) {
			const
				isRtl = this.list.context.rtl,
				isForward = (direction === 'down' || isRtl && direction === 'left' || !isRtl && direction === 'right');

			// To prevent item positioning issue, make all items to be rendered.
			this.list.updateFrom = null;
			this.list.updateTo = null;

			if (firstVisibleIndex <= indexToScroll && indexToScroll <= lastVisibleIndex) {
				const node = this.list.containerRef.querySelector(`[data-index='${indexToScroll}'].spottable`);

				if (node) {
					Spotlight.focus(node);
				}
			} else {
				// Scroll to the next spottable item without animation
				if (!Spotlight.isPaused()) {
					Spotlight.pause();
				}
				focusedItem.blur();
			}
			this.nodeIndexToBeFocused = this.lastFocusedIndex = indexToScroll;
			this.list.props.cbScrollTo({index: indexToScroll, stickTo: isForward ? 'end' : 'start', animate: false});
		}

		return true;
	}

	/**
	 * Handle a `onKeyDown` key
	 */

	_setRestrict = (bool) => {
		Spotlight.set(this.list.props['data-container-id'], {restrict: (bool) ? 'self-only' : 'self-first'});
	}

	_setSpotlightContainerRestrict = (keyCode, target) => {
		const
			{dataSize} = this.list.props,
			{isPrimaryDirectionVertical, dimensionToExtent} = this.list,
			index = Number.parseInt(target.getAttribute(dataIndexAttribute)),
			canMoveBackward = index >= dimensionToExtent,
			canMoveForward = index < (dataSize - (((dataSize - 1) % dimensionToExtent) + 1));
		let isSelfOnly = false;

		if (isPrimaryDirectionVertical) {
			if (isUp(keyCode) && canMoveBackward || isDown(keyCode) && canMoveForward) {
				isSelfOnly = true;
			}
		} else if (isLeft(keyCode) && canMoveBackward || isRight(keyCode) && canMoveForward) {
			isSelfOnly = true;
		}

		this._setRestrict(isSelfOnly);
	}

	_jumpToSpottableItem = (keyCode, target) => {
		const
			{cbScrollTo, data, dataSize} = this.list.props,
			{firstIndex, numOfItems} = this.list.state,
			currentIndex = Number.parseInt(target.getAttribute(dataIndexAttribute));

		if (!data || !Array.isArray(data) || !data[currentIndex] || data[currentIndex].disabled) {
			return false;
		}

		const
			isForward = (
				this.list.isPrimaryDirectionVertical && isDown(keyCode) ||
				!this.list.isPrimaryDirectionVertical && (!this.list.context.rtl && isRight(keyCode) || this.list.context.rtl && isLeft(keyCode)) ||
				null
			),
			isBackward = (
				this.list.isPrimaryDirectionVertical && isUp(keyCode) ||
				!this.list.isPrimaryDirectionVertical && (!this.list.context.rtl && isLeft(keyCode) || this.list.context.rtl && isRight(keyCode)) ||
				null
			);

		let nextIndex = -1;

		if (isForward) {
			// See if the next item is spottable then delegate scroll to onFocus handler
			if (currentIndex < dataSize - 1 && !data[currentIndex + 1].disabled) {
				return false;
			}

			for (let i = currentIndex + 2; i < dataSize; i++) {
				if (!data[i].disabled) {
					nextIndex = i;
					break;
				}
			}

			// If there is no item which could get focus forward,
			// we need to set restriction option to `self-first`.
			if (nextIndex === -1) {
				this._setRestrict(false);
			}
		} else if (isBackward) {
			// See if the next item is spottable then delegate scroll to onFocus handler
			if (currentIndex > 0 && !data[currentIndex - 1].disabled) {
				return false;
			}

			for (let i = currentIndex - 2; i >= 0; i--) {
				if (!data[i].disabled) {
					nextIndex = i;
					break;
				}
			}

			// If there is no item which could get focus backward,
			// we need to set restriction option to `self-first`.
			if (nextIndex === -1) {
				this._setRestrict(false);
			}
		} else {
			return false;
		}

		if (nextIndex !== -1 && (firstIndex > nextIndex || nextIndex >= firstIndex + numOfItems)) {
			// When changing from "pointer" mode to "5way key" mode,
			// a pointer is hidden and a last focused item get focused after 30ms.
			// To make sure the item to be blurred after that, we used 50ms.
			setTimeout(() => {
				target.blur();
			}, 50);

			this.nodeIndexToBeFocused = this.lastFocusedIndex = nextIndex;

			if (!Spotlight.isPaused()) {
				Spotlight.pause();
			}

			cbScrollTo({
				index: nextIndex,
				stickTo: isForward ? 'end' : 'start'
			});
			return true;
		}

		return false;
	}

	onKeyDown = (e) => {
		const {keyCode, target} = e;

		this.isScrolledBy5way = false;
		if (getDirection(keyCode)) {
			this._setSpotlightContainerRestrict(keyCode, target);
			this.isScrolledBy5way = this._jumpToSpottableItem(keyCode, target);
		}
		forwardKeyDown(e, this.list.props);
	}

	/**
	 * Handle a global `onKeyDown`
	 */

	handleGlobalKeyDown = () => {
		this.setContainerDisabled(false);
	}

	setContainerDisabled = (bool) => {
		const containerNode = this.list.containerRef;

		if (containerNode) {
			containerNode.setAttribute(dataContainerDisabledAttribute, bool);

			if (bool) {
				document.addEventListener('keydown', this.handleGlobalKeyDown, {capture: true});
			} else {
				document.removeEventListener('keydown', this.handleGlobalKeyDown, {capture: true});
			}
		}
	}

	/**
	 * Focus on the Node of the VirtualList item
	 */

	focusOnNode = (node) => {
		if (Spotlight.isPaused()) {
			Spotlight.resume();
			this.list.forceUpdate();
		}

		if (node) {
			Spotlight.focus(node);
		}
		this.nodeIndexToBeFocused = null;
	}

	/**
	 * Manage a placeholder
	 */

	_isNeededScrollingPlaceholder = () => this.nodeIndexToBeFocused != null && Spotlight.isPaused();

	_handlePlaceholderFocus = (ev) => {
		const placeholder = ev.currentTarget;

		if (placeholder) {
			const index = placeholder.dataset.index;

			if (index) {
				this.preservedIndex = parseInt(index);
				this.restoreLastFocused = true;
			}
		}
	}

	withPlaceholder = (children) => {
		const
			{primary} = this.list,
			needsScrollingPlaceholder = this._isNeededScrollingPlaceholder(),
			cc = [
				children,
				primary ?
					null :
					<SpotlightPlaceholder
						data-index={0}
						data-vl-placeholder
						onFocus={this._handlePlaceholderFocus}
						role="region"
					/>,
				needsScrollingPlaceholder ? <SpotlightPlaceholder /> : null
			];

		return cc;
	}

	/**
	 * Restore the focus of VirtualList
	 */

	_isPlaceholderFocused () {
		const current = Spotlight.getCurrent();

		if (current && current.dataset.vlPlaceholder && this.list.containerRef.contains(current)) {
			return true;
		}

		return false;
	}

	restoreFocus () {
		if (
			this.restoreLastFocused &&
			!this._isPlaceholderFocused()
		) {
			const containerId = this.list.props['data-container-id'];
			const node = this.list.containerRef.querySelector(
				`[data-container-id="${containerId}"] [data-index="${this.list.preservedIndex}"]`
			);

			if (node) {
				// if we're supposed to restore focus and virtual list has positioned a set of items
				// that includes lastFocusedIndex, clear the indicator
				this.restoreLastFocused = false;

				// try to focus the last focused item
				const foundLastFocused = Spotlight.focus(node);

				// but if that fails (because it isn't found or is disabled), focus the container so
				// spotlight isn't lost
				if (!foundLastFocused) {
					this.restoreLastFocused = true;
					Spotlight.focus(containerId);
				}
			}
		}
	}

	/**
	 * setter/getter
	 */

	shouldPreventScrollByFocus = () => this.isScrolledBy5way

	setLastFocusedIndex = (item) => {
		this.lastFocusedIndex = Number.parseInt(item.getAttribute(dataIndexAttribute));
	}
}

export default VirtualListSpotlightManager;
export {
	VirtualListSpotlightManager,
	SpotlightPlaceholder,
	VirtualListSpotlightContainerDecorator
};
