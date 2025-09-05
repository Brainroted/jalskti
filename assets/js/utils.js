/*
 * assets/js/utils.js
 * Provides helper functions for parsing, date formatting, and local storage.
 */

window.RTWQMS = window.RTWQMS || {};

(function(RTWQMS) {
    "use strict";

    // Namespace for utility functions
    const utils = {};

    /**
     * Safely parses a string into a floating-point number.
     * @param {string|number} value - The value to parse.
     * @returns {number|null} The parsed number or null if invalid.
     */
    utils.parseNumber = (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    };

    /**
     * Formats a date string or Date object into 'YYYY-MM-DD'.
     * @param {string|Date} dateInput - The date to format.
     * @returns {string} The formatted date string.
     */
    utils.formatDate = (dateInput) => {
        if (!dateInput) return '';
        try {
            const date = new Date(dateInput);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return '';
        }
    };

    /**
     * A simple debouncer to limit how often a function can run.
     * @param {Function} func - The function to debounce.
     * @param {number} delay - The debounce delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    utils.debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };

    /**
     * Safely get and parse JSON from localStorage.
     * @param {string} key - The localStorage key.
     * @returns {object|null} The parsed object or null on error.
     */
    utils.storageGet = (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error(`Error reading from localStorage key "${key}":`, e);
            return null;
        }
    };

    /**
     * Safely set a value in localStorage by converting it to JSON.
     * @param {string} key - The localStorage key.
     * @param {*} value - The value to store.
     */
    utils.storageSet = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error writing to localStorage key "${key}":`, e);
        }
    };

    // Expose the utils object to the global namespace
    RTWQMS.utils = utils;

})(window.RTWQMS);