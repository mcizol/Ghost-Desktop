import Ember from 'ember';
import {getIsYosemiteOrHigher} from '../utils/versions';

const {Component, inject, computed} = Ember;

/**
 * The switcher component is a Slack-like quick switcher on the left side of
 * the app, allowing users to quickly switch between blogs.
 */
export default Component.extend({
    store: inject.service(),
    preferences: inject.service(),
    windowMenu: inject.service(),
    classNameBindings: ['isMinimized', 'isMac:mac', 'isVibrant', ':switcher', ':win-height-adjusted'],
    isMinimized: computed.alias('preferences.isQuickSwitcherMinimized'),
    isMac: !!(process.platform === 'darwin'),
    isVibrant: getIsYosemiteOrHigher(),
    sortedBlogs: computed.sort('blogs', 'sortDefinition'),
    sortDefinition: ['index'],

    didRender() {
        this._super(...arguments);

        this._setupContextMenu();
        this._setupQuickSwitch();
        this._setupMenuItem();
    },

    /**
     * Setup shortcut handling for switching to blogs, and switching to
     * the preferences pane.
     */
    _setupQuickSwitch() {
        const blogMenuItems = [{type: 'separator'}];

        // The first 9 blogs are added to the 'View' menu.
        this.get('sortedBlogs')
            .slice(0, 8)
            .map((blog, i) => {
                blogMenuItems.push({
                    accelerator: `CmdOrCtrl+${i + 1}`,
                    click: () => this.send('switchToBlog', blog),
                    label: blog.get('name')
                });
            });

        this.get('windowMenu').addQuickSwitchItemsToMenu(
            () => this.send('showPreferences'),
            blogMenuItems
        );
    },

    /**
     * In addition to the app-wide context menu, a context menu allowing
     * interaction with the blog below is setup.
     */
    _setupContextMenu() {
        const {remote} = requireNode('electron');
        const {Menu} = remote;
        const self = this;
        let selectedBlog = null;

        const editMenu = Menu.buildFromTemplate([
            {
                label: 'Edit Blog',
                click() {
                    if (selectedBlog) {
                        self.editBlog(selectedBlog);
                    }
                }
            },
            {
                label: 'Remove Blog',
                click() {
                    if (selectedBlog) {
                        self.removeBlog(selectedBlog);
                    }
                }
            },
            {
                label: 'New Icon Color',
                click() {
                    if (selectedBlog) {
                        self.changeBlogColor(selectedBlog);
                    }
                }
            }
        ]);

        this.$()
            .off('contextmenu')
            .on('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();

                let node = e.target;

                while (node) {
                    if (node.classList && node.classList.contains('switch-btn')
                        && node.dataset && node.dataset.blog) {
                        selectedBlog = node.dataset.blog;
                        editMenu.popup(remote.getCurrentWindow());
                        break;
                    }

                    node = node.parentNode;
                }
            });
    },

    /**
     * Inserts the MenuItem for the toggle action into the app's menu,
     * using the window menu service
     */
    _setupMenuItem() {
        const windowMenu = this.get('windowMenu');

        windowMenu.injectMenuItem({
            menuName: 'View',
            click: () => this.send('toggle'),
            name: 'toggle-quick-switcher',
            label: 'Toggle Quick Switcher',
            accelerator: 'CmdOrCtrl+Alt+Q',
            position: 2
        });
    },

    /**
     * Gives a blog a random color
     *
     * @param id - Ember Data id of the blog to change the color of.
     */
    changeBlogColor(id) {
        if (id) {
            this.get('store').findRecord('blog', id)
                .then((result) => {
                    if (result) {
                        result.randomIconColor();
                        result.save();
                    }
                });
        }
    },

    /**
     * Remove a blog
     *
     * @param id - Ember Data id of the blog to remove
     */
    removeBlog(id) {
        if (id) {
            this.get('store').findRecord('blog', id)
                .then((result) => {
                    if (result) {
                        result.deleteRecord();
                        result.save().then(() => this.sendAction('blogRemoved'));
                    }
                });
        }
    },

    /**
     * Show the "edit blog" UI, passing along the blog object for a given id
     *
     * @param id - Ember Data id of the blog to edit
     */
    editBlog(id) {
        if (id) {
            this.get('store').findRecord('blog', id)
                .then((result) => {
                    if (result) {
                        this.sendAction('showEditBlog', result);
                    }
                });
        }
    },

    actions: {
        /**
         * Switch to a blog
         *
         * @param blog - Blog to switch to
         */
        switchToBlog(blog) {
            this.sendAction('switchToBlog', blog);
        },

        /**
         * Switch to the "add blog" UI
         */
        showAddBlog() {
            this.sendAction('showAddBlog');
        },

        /**
         * Switch to the "preferences" UI
         */
        showPreferences() {
            this.sendAction('showPreferences');
        },

        /**
         * Toggles the width of the quickswitcher (keeping all elements
         * otherwise alive and well)
         */
        toggle() {
            this.toggleProperty('isMinimized');
        },

        /**
         * Called by ember-sortable when the order of elements
         * changes
         */
        reorderItems(reorderedBogs) {
            reorderedBogs.forEach((blog, i) => {
                blog.set('index', i);
            });

            this._setupContextMenu();
            this._setupQuickSwitch();
            this._setupMenuItem();
        }
    }
});
