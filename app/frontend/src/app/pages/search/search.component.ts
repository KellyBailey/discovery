import {
  Component,
  OnInit,
  Input,
  ViewChild,
  HostListener
} from '@angular/core';
import { SearchService } from './search.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ActiveFiltersComponent } from './filters/active-filters.component';
import { ModalService } from '../../common/modal.service';
import { FiltersComponent } from './filters.component';
import { TblVendorsComponent } from './tbl-vendors.component';
declare const document: any;
declare const $: any;
@Component({
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit {
  @Input()
  selected_filters: any[];
  @ViewChild(ActiveFiltersComponent)
  activeFiltersComponent: ActiveFiltersComponent;
  @ViewChild(FiltersComponent)
  filtersComponent: FiltersComponent;

  vw_contracts = true;
  vw_vendors = false;
  error_message;
  contracts_compare;
  contracts_results = [];
  contracts_w_no_records = [];
  vendors_results;
  vendors_no_results = false;
  show_details = false;
  show_results = false;
  compare_tbl;
  vehicles;
  results;
  _sort_by: string;
  num_show = 3;
  _spinner: boolean;
  filters: any[];
  scroll_buttons = false;
  server_error = false;
  @HostListener('window:resize')
  onResize() {
    if (document.getElementById('discovery').classList.contains('push')) {
      this.hideSideNavFilters();
    }
  }
  constructor(
    private searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    /** Check to see if there are any queryparams */
    if (this.route.snapshot.queryParamMap.keys.length > 0) {
      this.spinner = true;
    } else {
      this.spinner = false;
    }
  }
  get sort_by(): string {
    return this._sort_by;
  }
  set sort_by(value: string) {
    this._sort_by = value;
  }
  get spinner(): boolean {
    return this._spinner;
  }
  set spinner(value: boolean) {
    this._spinner = value;
  }

  buildSelectedItems(arr: string[]): any[] {
    const items = [];
    for (const i of arr) {
      const item = {};
      item['value'] = i;
      items.push(item);
    }
    return items;
  }

  submitSelectedFilters(filters) {
    this.server_error = false;
    this.spinner = true;
    this.filters = filters;
    this.searchService.activeFilters = filters;
    this.searchService.setQueryParams(filters);

    this.searchService
      .getVendors(this.searchService.activeFilters, '&page=0')
      .subscribe(
        data => {
          if (data['count'] === 0) {
            this.spinner = false;
            this.vendors_no_results = true;
            this.show_results = true;
            this.results = [];
            return;
          }
          this.results = this.buildVendorByVehicle(data['results']);
          this.vendors_no_results = false;
          this.show_results = true;
          this.spinner = false;
          this.buildContractCompare();
          this.sort_by = this.getFirstVehicleWithVendors();
          this.viewContracts();
        },
        error => {
          this.error_message = <any>error;
          this.server_error = true;
        }
      );
  }
  showSpinner(bool: boolean) {
    this.spinner = bool;
  }
  getFirstVehicleWithVendors() {
    for (const item of this.compare_tbl) {
      if (item.vendors_results_total > 0) {
        return item.id;
      }
    }
  }
  /** Checks if vehicles were submitted  */
  returnSubmittedVehicles(): any[] {
    for (const item of this.searchService.activeFilters) {
      if (item.name === 'vehicles') {
        return item;
      }
    }
    return [];
  }
  filterResultsByVehicle(vehicle: string) {
    return this.results.vendors.filter(
      vendor => vendor.vehicles.indexOf(vehicle) !== -1
    );
  }
  clearActiveFilters(bool) {
    this.activeFiltersComponent.clear();
  }
  viewVendors() {
    this.vw_vendors = true;
    this.vw_contracts = false;
  }
  viewContracts() {
    this.vw_contracts = true;
    this.vw_vendors = false;
  }
  buildVendorByVehicle(obj: any[]) {
    const vehicles_submitted = this.returnSubmittedVehicles();
    const results = {};
    results['vehicles'] = [];
    const vehicles: any[] = [];
    for (const item of obj) {
      const vendor = {};
      const asides_arr = [];
      vendor['name'] = item.name;
      vendor['duns'] = item.duns;
      vendor['contracts'] = item.number_of_contracts;
      // vendor['tier'] = item.number_of_contracts;
      vendor['vehicles'] = this.returnVehicleVendors(item.pools);

      if (vehicles_submitted['selected']) {
        results['vehicles'] = this.returnVehicleValues(
          vehicles_submitted['selected']
        );
      } else {
        for (const i of item.pools) {
          if (!results['vehicles'].includes(i.pool.vehicle.id)) {
            results['vehicles'].push(i.pool.vehicle.id);
          }
        }
      }

      if (item.pools[0].setasides) {
        for (const asides of item.pools[0].setasides) {
          asides_arr.push(asides['code']);
        }
        vendor['setasides'] = asides_arr;
      } else {
        vendor['setasides'] = [];
      }
      vehicles.push(vendor);
    }
    results['vendors'] = vehicles;
    return results;
  }
  returnVehicleValues(obj: any[]) {
    const arr: any[] = [];
    for (const i of obj) {
      arr.push(i['value']);
    }
    return arr.sort(this.searchService.sortByNameAsc);
  }
  returnVehicleVendors(obj: any[]) {
    const vendors = [];
    for (const item of obj) {
      if (!vendors.includes(item.pool.vehicle.id)) {
        vendors.push(item.pool.vehicle.id);
      }
    }
    return vendors;
  }
  countVendorsByVehicle(vehicle: string) {
    const count = this.results.vendors.filter(
      item => item.vehicles.indexOf(vehicle) !== -1
    );
    return count.length;
  }
  buildContractCompare() {
    const compare: any[] = [];
    this.contracts_w_no_records = [];
    for (const vehicle of this.results.vehicles) {
      const item: any[] = [];
      const vehicle_obj = this.filtersComponent.getVehicleData(vehicle);

      item['id'] = vehicle;
      item['vendors_total'] = 0;
      item['vendors_results_total'] = this.countVendorsByVehicle(vehicle);
      item['description'] = vehicle_obj['name'];
      item[
        'service_categories'
      ] = this.filtersComponent.getServiceCategoriesByVehicle(vehicle);
      item['capabilities'] = 0;
      item['naics'] = this.filtersComponent.getNaicsByVehicle(vehicle);
      item['pscs'] = this.filtersComponent.getPSCsByVehicle(vehicle);

      item['tier'] = vehicle_obj['tier']['name'];
      item['gsa'] = vehicle_obj['poc'];
      // item['website'] = vehicle_obj['url'];
      item['ordering_guide'] = vehicle_obj['ordering_guide'];
      compare.push(item);
      if (item['vendors_results_total'] === 0) {
        this.contracts_w_no_records.push({ name: item['description'] });
      }
    }
    this.compare_tbl = compare;
    if (this.compare_tbl.length > 3) {
      this.scroll_buttons = true;
    } else {
      this.scroll_buttons = false;
    }
  }
  showServerError(error: number) {
    if (error === 1) {
      this.server_error = true;
    }
  }
  toggleTDHeights(id: string) {
    const doc = document.getElementsByClassName(id);
    for (const ele of doc) {
      ele.classList.toggle('show_all');
    }
  }
  showSideNavFilters() {
    document.getElementById('filters-container').style.left = '0px';
    document.getElementById('discovery').classList.add('push');
    document.getElementById('overlay-filter-mobile').classList.add('show');
    document.getElementById('btn-show-filters').style.display = 'none';
  }
  hideSideNavFilters() {
    document.getElementById('filters-container').style.left = '-310px';
    document.getElementById('discovery').classList.remove('push');
    document.getElementById('overlay-filter-mobile').classList.remove('show');
    document.getElementById('btn-show-filters').style.display = 'block';
  }
  commaSeparatedList(obj: any[], key: string) {
    let items = '';
    for (const i of obj) {
      items += i[key] + ', ';
    }
    return items.slice(0, -2);
  }
  viewVehicleVendors(vehicle: string) {
    this.sort_by = vehicle;
    this.viewVendors();
  }
  openModal(id: string) {
    this.modalService.open(id);
  }
  closeModal(id: string) {
    this.modalService.close(id);
  }
  scrollRight() {
    const container = document.getElementById('overflow-compare');
    let scrollAmount = 0;
    const slideTimer = setInterval(() => {
      container.scrollLeft += 20;
      scrollAmount += 10;
      if (scrollAmount >= 100) {
        clearInterval(slideTimer);
      }
    }, 25);
  }
  scrollLeft() {
    const container = document.getElementById('overflow-compare');
    let scrollAmount = 0;
    const slideTimer = setInterval(() => {
      container.scrollLeft -= 20;
      scrollAmount += 10;
      if (scrollAmount >= 100) {
        clearInterval(slideTimer);
      }
    }, 25);
  }
}