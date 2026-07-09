import _ from "lodash";
import $ from "jquery";
import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

window._ = _;
window.$ = window.jQuery = $;

// Set up global AJAX settings
$.ajaxSetup({
    headers: {'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')}
});
