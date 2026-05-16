import { Routes } from '@angular/router';
import { Group } from './component/group/group';
import { Map } from './component/map/map';
import { Login } from './component/login/login';
import { Signup } from './component/signup/signup';

export const routes: Routes = [
	{ path: '', component: Login },
    { path: 'signup', component: Signup },
    { path: 'map', component: Map },
	{ path: 'group', component: Group },
];
