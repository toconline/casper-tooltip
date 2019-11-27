/*
  - Copyright (c) 2016 Cloudware S.A. All rights reserved.
  -
  - This file is part of casper-tooltip.
  -
  - casper-tooltip is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - casper-tooltip  is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with casper-tooltip.  If not, see <http://www.gnu.org/licenses/>.
  -
 */

import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';

class CasperTooltip extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          display: block;
          position: absolute;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-user-select: none;
          user-select: none;
          width: 50px;
          z-index: 200; /* to be above the wizard */
        }

        .visible {
          visibility: visible;
          opacity: 1;
          transition: visibility 0.1s, opacity 0.1s linear;
        }

        .hidden {
          visibility: hidden;
          opacity: 0;
          transition: visibility 0.5s, opacity 0.5s ease-in;
        }

        #canvas {
          position: absolute;
        }

        #text {
          text-transform: uppercase;
          text-align: center;
          position: absolute;
          padding: 5px;
          font-size: 10px;
          color: white;
          cursor: pointer;
        }

      </style>
      <canvas id="canvas"></canvas>
      <div id="text"></div>
    `;
  }

  static get is () {
    return 'casper-tooltip';
  }

  static get properties () {
    return {
      radius: {
        type: Number,
        value: 5
      },
      tipHeight: {
        type: Number,
        value: 5
      },
      tipBase: {
        type: Number,
        value: 10
      },
      tipLocation: {
        type: Number,
        value: 0.5
      },
      tipEdge: {
        type: String,
        value: 'N'
      },
      positionTarget: {
        type: Element
      },
      fitInto: {
        type: Element
      }
    };
  }

  ready () {
    super.ready();
    this._ctx = this.$.canvas.getContext('2d');
    this._setupPixelRatio();
    this.addEventListener('click', e => this.hide(e));
  }

  connectedCallback () {
    super.connectedCallback();
    this._showing = false;
    this.setVisible(false);
  }

  /**
   * Function that is called to bind mouseMovement to look for tooltips
   */
  mouseMoveToolip (event, maxDepth = 3) {
    let depth = 0;
    const targetPath = event.composedPath ? event.composedPath() : event.path;

    // Still inside the Tooltip -- Abort
    if ( this._tooltipBbox !== undefined ) {
      if (event.clientX >= this._tooltipBbox.left && event.clientX <= this._tooltipBbox.right &&
          event.clientY >= this._tooltipBbox.top  && event.clientY <= this._tooltipBbox.bottom) {
        return;
      }
      this.hide();
      this._tooltipBbox = undefined;
    }

    let firstTargetableElement = undefined;
    // Find a tooltip, and open it at the first element
    for ( let target of targetPath ) {
      if ( target instanceof HTMLElement && target.tagName !== 'SLOT' ) {
        if ( firstTargetableElement === undefined && !target.hasAttribute('no-tooltip') ) {
          firstTargetableElement = target;
        }
        const tooltip = target.tooltip ? (target.tooltip === this ? undefined : target.tooltip) : target.getAttribute('tooltip');
        if ( tooltip && firstTargetableElement ) {
          this._tooltipBbox = target.getBoundingClientRect();
          this.show(tooltip, firstTargetableElement);
          return;
        }
      }
      if ( ++depth === maxDepth ) {
        break;
      }
    }
  }

  setVisible (visible) {
    if ( visible ) {
      this.$.canvas.classList.remove('hidden');
      this.$.text.classList.remove('hidden');
      this.$.canvas.classList.add('visible');
      this.$.text.classList.add('visible');
    } else {
      this.$.canvas.classList.add('hidden');
      this.$.text.classList.add('hidden');
      this.$.canvas.classList.remove('visible');
      this.$.text.classList.remove('visible');
    }
  }

  /**
   * Layout tool tip and set text
   *
   * The bounding box of the "controlling" area is used to position the tooltip below. The arrow
   * is centered along the lower edge of the controller and body of the tooltip is adjusted to
   * fit inside the page.
   *
   * @param content The html content to put inside the tooltip
   * @param positionTarget the element where the tooltip is positioned (or a target rectangle)
   */
  show (content, positionTarget) {
    let tooltipWidth, tooltipArrowX, tooltipLeft, arrowLoc, fitInto, positionRect;

    fitInto = this.fitInto.getBoundingClientRect();
    if ( positionTarget === undefined ) {
      positionRect = this.positionRect.getBoundingClientRect(); // use internal attribute target
    } else {
      if ( positionTarget instanceof Element ) {
        positionTarget = positionTarget.getBoundingClientRect();
      }
      positionRect =  {
        left:   positionTarget.left + fitInto.left,
        top:    positionTarget.top  + fitInto.top,
        bottom: positionTarget.top  + fitInto.top + positionTarget.height,
        right:  positionTarget.left + fitInto.left + positionTarget.width,
        width:  positionTarget.width,
        height: positionTarget.height
      };
    }

    this._showing = true;
    this.setVisible(true);

    // ... set text and size the tooltip, max width up to 100% of page width ...
    this.style.width = fitInto.width + 'px';
    this.$.text.style.margin = '0px';
    this.$.text.style.marginTop = this.tipHeight + 'px';
    this.$.text.innerHTML = content;

    // ... layout the tooltip so that it's stays inside the page ...
    tooltipWidth  = this.$.text.getBoundingClientRect().width;
    tooltipArrowX = positionRect.left + positionRect.width / 2;
    tooltipLeft   = tooltipArrowX - tooltipWidth / 2;
    arrowLoc      = 0.5;

    if ( tooltipLeft < fitInto.left ) {
      tooltipLeft = fitInto.left;
      arrowLoc = (tooltipArrowX - tooltipLeft) / tooltipWidth;
    } else if ( tooltipLeft + tooltipWidth > fitInto.left + fitInto.width ) {
      tooltipLeft = fitInto.left + fitInto.width - tooltipWidth;
      arrowLoc = (tooltipArrowX - tooltipLeft) / tooltipWidth;
    }

    // ... position relative to fitInto and show the tooltip ...
    this.tipLocation = arrowLoc;
    this.style.left = tooltipLeft - fitInto.left + 'px';
    this.style.top  = positionRect.bottom - fitInto.top  + 'px';
    this._updateBalloon();
  }

  hide () {
    // If the tooltip is already hidden, there's nothing to do.
    if (!this._showing) {
      return;
    }
    this._showing = false;
    this.setVisible(false);
  }

  _updateBalloon () {
    let width, height, bb;

    bb = this.$.text.getBoundingClientRect();
    switch(this.tipEdge) {
      case 'N':
      case 'S':
        height = bb.height + this.tipHeight;
        width  = bb.width;
        break;
      case 'W':
      case 'E':
        height = bb.height;
        width  = bb.width + this.tipHeight + this.radius;
        break;
    }
    this.$.canvas.width = width * this._ratio;
    this.$.canvas.height = height * this._ratio;
    this.$.canvas.style.width  = width + 'px';
    this.$.canvas.style.height = height + 'px';
    this._paintBalloon(width - 1, height -1);
  }

  /**
   * @brief Determine the device pixel ratio: 1 on classical displays 2 on retina/UHD displays
   */
  _setupPixelRatio () {
    let devicePixelRatio  = window.devicePixelRatio || 1;
    if (devicePixelRatio > 1.6) {
      devicePixelRatio = 2;
    } else {
      devicePixelRatio = 1;
    }
    let backingStoreRatio = this._ctx.webkitBackingStorePixelRatio ||
                            this._ctx.mozBackingStorePixelRatio ||
                            this._ctx.msBackingStorePixelRatio ||
                            this._ctx.oBackingStorePixelRatio ||
                            this._ctx.backingStorePixelRatio || 1;
    this._ratio = devicePixelRatio / backingStoreRatio;
  }

  /**
   * @brief Prepares a rounded rect path, does not paint or stroke it
   *
   * @param {number} x upper left corner
   * @param {number} y upper left corner
   * @param {number} w width of the round rectangle
   * @param {number} h height of the round rectangle
   * @param {number} r corner radius
   */
  _makeRoundRectPath (x, y, w, h, r) {
    this._ctx.moveTo( x + r, y );
    this._ctx.arcTo(  x + w, y    , x + w    , y + r    , r);
    this._ctx.arcTo(  x + w, y + h, x + w - r, y + h    , r);
    this._ctx.arcTo(  x    , y + h, x        , y + h - r, r);
    this._ctx.arcTo(  x    , y    , x + r    , y        , r);
  }

  /**
   * Paints the balloon shape on the canvas object
   *
   * @param {number} width width in pixels of the balloon
   * @param {number} height height in pixels of the balloon
   */
  _paintBalloon (width, height) {
    let tipLocation, tipHeight, tipBase, radius;

    this._ctx.fillStyle = '#000';
    this._ctx.globalAlpha = 0.75;

    radius    = this.radius    * this._ratio;
    tipHeight = this.tipHeight * this._ratio;
    tipBase   = this.tipBase   * this._ratio;
    width    *= this._ratio;
    height   *= this._ratio;
    this._ctx.beginPath();
    switch (this.tipEdge) {
      case 'N':
      default:
        this._makeRoundRectPath(0, 0 + tipHeight, width, height - tipHeight, radius);
        tipLocation = Math.round(0 + width * this.tipLocation);
        this._ctx.moveTo(tipLocation, 0);
        this._ctx.lineTo(tipLocation + Math.round(tipBase / 2), 0 + tipHeight);
        this._ctx.lineTo(tipLocation - Math.round(tipBase / 2), 0 + tipHeight);
        this._ctx.lineTo(tipLocation, 0);
        break;
      case 'E':
        this._makeRoundRectPath(0, 0, width - tipHeight, height, radius);
        tipLocation = Math.round(0 + height * this.tipLocation);
        this._ctx.moveTo(0 + width, tipLocation);
        this._ctx.lineTo(0 + width - tipHeight, Math.round(tipLocation - tipBase/ 2));
        this._ctx.lineTo(0 + width - tipHeight, Math.round(tipLocation + tipBase/ 2));
        this._ctx.lineTo(0 + width, tipLocation);
        break;
      case 'S':
        this._makeRoundRectPath(0, 0, width, height - tipHeight, radius);
        tipLocation = Math.round(0 + width * this.tipLocation);
        this._ctx.moveTo(tipLocation, 0 + height);
        this._ctx.lineTo(tipLocation + Math.round(tipBase / 2), 0 + height - tipHeight);
        this._ctx.lineTo(tipLocation - Math.round(tipBase / 2), 0 + height - tipHeight);
        this._ctx.lineTo(tipLocation, 0 + height);
        break;
      case 'W':
        this._makeRoundRectPath(0 + tipHeight, 0, width - tipHeight, height, radius);
        tipLocation = Math.round(0 + height * this.tipLocation);
        this._ctx.moveTo(0, tipLocation);
        this._ctx.lineTo(0 + tipHeight, Math.round(tipLocation - tipBase/ 2));
        this._ctx.lineTo(0 + tipHeight, Math.round(tipLocation + tipBase/ 2));
        this._ctx.lineTo(0, tipLocation);
        break;
    }
    this._ctx.closePath();
    this._ctx.fill();
  }
}

window.customElements.define(CasperTooltip.is, CasperTooltip);